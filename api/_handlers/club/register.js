const { sql } = require('../../_lib/db');
const { normalizeCode } = require('../../_lib/codeGen');
const { hashPassword, createSessionCookie } = require('../../_lib/clubAuth');
const { isValidEmail, isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { getClientIp, isCodeRateLimited, recordCodeAttempt } = require('../../_lib/rateLimit');

// Ativa um código real: reivindica o código atomicamente (UPDATE ... WHERE
// status='ativo', então uma corrida entre dois cadastros com o mesmo código
// só deixa um vencer), cria/atualiza a conta do cliente, concede os cupons
// de boas-vindas (auto_grant) e abre a sessão. Nunca expõe outros códigos.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const ip = getClientIp(req);
  try {
    if (await isCodeRateLimited(ip)) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' });
      return;
    }
  } catch (e) {
    // segue sem bloquear
  }

  const body = await readJsonBody(req);
  const code = normalizeCode(body.code);
  const name = str(body.name);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = str(body.phone);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!code) {
    res.status(400).json({ ok: false, error: 'Código é obrigatório.' });
    return;
  }
  if (!isNonEmptyString(name, 120)) {
    res.status(400).json({ ok: false, error: 'Informe seu nome.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'E-mail inválido.' });
    return;
  }
  if (!isNonEmptyString(password) || password.length < 6) {
    res.status(400).json({ ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' });
    return;
  }

  const claim = await sql`
    UPDATE club_codes SET status = 'utilizado', activated_at = now()
    WHERE code = ${code} AND status = 'ativo'
    RETURNING id
  `;

  if (!claim.rows.length) {
    const { rows: existing } = await sql`SELECT status FROM club_codes WHERE code = ${code}`;
    try { await recordCodeAttempt(ip, false); } catch (e) { /* best effort */ }
    if (!existing.length) {
      res.status(404).json({ ok: false, error: 'Código não encontrado.' });
      return;
    }
    res.status(409).json({ ok: false, error: existing[0].status === 'bloqueado' ? 'Este código está bloqueado.' : 'Este código já foi utilizado.' });
    return;
  }

  const codeRowId = claim.rows[0].id;

  const { rows: existingCustomer } = await sql`SELECT id, club_member FROM customers WHERE email = ${email}`;
  if (existingCustomer.length && existingCustomer[0].club_member) {
    await sql`UPDATE club_codes SET status = 'ativo', activated_at = NULL WHERE id = ${codeRowId}`;
    res.status(409).json({ ok: false, error: 'Este e-mail já possui uma conta no Clube. Faça login.' });
    return;
  }

  const passwordHash = hashPassword(password);
  const { rows: customerRows } = await sql`
    INSERT INTO customers (name, email, phone, password_hash, club_member, club_code_used, club_joined_at)
    VALUES (${name}, ${email}, ${phone || null}, ${passwordHash}, true, ${code}, now())
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      password_hash = EXCLUDED.password_hash,
      club_member = true,
      club_code_used = EXCLUDED.club_code_used,
      club_joined_at = now()
    RETURNING *
  `;
  const customer = customerRows[0];

  await sql`UPDATE club_codes SET customer_id = ${customer.id} WHERE id = ${codeRowId}`;

  // Número de membro é atribuído uma única vez, na primeira ativação —
  // nunca reatribuído se o cliente já tinha um (reativação/upgrade de conta).
  if (!customer.member_number) {
    const { rows: numbered } = await sql`
      UPDATE customers SET member_number = 'VRT-' || LPAD(id::text, 6, '0')
      WHERE id = ${customer.id} AND member_number IS NULL
      RETURNING member_number
    `;
    if (numbered.length) customer.member_number = numbered[0].member_number;
  }

  await sql`
    INSERT INTO customer_coupons (customer_id, coupon_id)
    SELECT ${customer.id}, id FROM coupons WHERE auto_grant = true AND active = true
    ON CONFLICT (customer_id, coupon_id) DO NOTHING
  `;

  try { await recordCodeAttempt(ip, true); } catch (e) { /* best effort */ }

  res.setHeader('Set-Cookie', createSessionCookie(req, customer.id, customer.session_version));
  delete customer.password_hash;
  res.status(201).json({ ok: true, customer });
};
