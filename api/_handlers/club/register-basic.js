const { sql } = require('../../_lib/db');
const { hashPassword, createSessionCookie } = require('../../_lib/clubAuth');
const { isValidEmail, isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { getClientIp, isClubLoginRateLimited, recordClubLoginAttempt } = require('../../_lib/rateLimit');

// Cadastro SEM código — vira "Iniciante" (club_member=false). Nunca recebe
// member_number (isso só acontece na ativação de um código real, em
// register.js ou activate-code.js) e nunca reivindica/toca club_codes.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const ip = getClientIp(req);
  try {
    if (await isClubLoginRateLimited(ip)) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' });
      return;
    }
  } catch (e) {
    // segue sem bloquear
  }

  const body = await readJsonBody(req);
  const name = str(body.name);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const passwordConfirm = typeof body.passwordConfirm === 'string' ? body.passwordConfirm : password;

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
  if (password !== passwordConfirm) {
    res.status(400).json({ ok: false, error: 'As senhas não coincidem.' });
    return;
  }

  const { rows: existingRows } = await sql`SELECT id, club_member, password_hash FROM customers WHERE email = ${email}`;
  const existing = existingRows[0];

  if (existing && existing.club_member) {
    res.status(409).json({ ok: false, error: 'Este e-mail já é Membro Verité. Faça login.' });
    return;
  }
  if (existing && existing.password_hash) {
    res.status(409).json({ ok: false, error: 'Este e-mail já possui uma conta. Faça login.' });
    return;
  }

  const passwordHash = hashPassword(password);
  let customer;
  try {
    if (existing) {
      // Linha "fantasma" criada por uma compra sem conta (sem password_hash
      // ainda) — vira a conta Iniciante dessa pessoa, sem duplicar cliente.
      const { rows } = await sql`
        UPDATE customers SET name = ${name}, password_hash = ${passwordHash}, club_joined_at = now()
        WHERE id = ${existing.id} RETURNING *
      `;
      customer = rows[0];
    } else {
      const { rows } = await sql`
        INSERT INTO customers (name, email, password_hash, club_member, club_joined_at)
        VALUES (${name}, ${email}, ${passwordHash}, false, now())
        RETURNING *
      `;
      customer = rows[0];
    }
  } catch (e) {
    res.status(409).json({ ok: false, error: 'Este e-mail já possui uma conta. Faça login.' });
    return;
  }

  try { await recordClubLoginAttempt(ip, true); } catch (e) { /* best effort */ }

  res.setHeader('Set-Cookie', createSessionCookie(req, customer.id, customer.session_version));
  delete customer.password_hash;
  res.status(201).json({ ok: true, customer });
};
