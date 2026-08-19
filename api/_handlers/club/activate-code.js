const { sql } = require('../../_lib/db');
const { normalizeCode } = require('../../_lib/codeGen');
const { requireClubSession } = require('../../_lib/clubAuth');
const { readJsonBody } = require('../../_lib/readBody');
const { notify } = require('../../_lib/clubNotify');
const { getClientIp, isCodeRateLimited, recordCodeAttempt } = require('../../_lib/rateLimit');

// Upgrade de uma conta já logada (Iniciante) para Membro Verité — nunca cria
// conta nova, nunca duplica cliente. Preserva favoritos/compras/histórico/
// club_joined_at original; só liga o código à conta existente.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const customer = await requireClubSession(req, res);
  if (!customer) return;

  if (customer.club_member) {
    res.status(409).json({ ok: false, error: 'Sua conta já é Membro Verité.' });
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
  if (!code) {
    res.status(400).json({ ok: false, error: 'Informe o código do seu cartão.' });
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

  const { rows: updatedRows } = await sql`
    UPDATE customers SET club_member = true, club_code_used = ${code}
    WHERE id = ${customer.id} RETURNING *
  `;
  let updated = updatedRows[0];

  await sql`UPDATE club_codes SET customer_id = ${updated.id} WHERE id = ${codeRowId}`;

  if (!updated.member_number) {
    const { rows: numbered } = await sql`
      UPDATE customers SET member_number = 'VRT-' || LPAD(id::text, 6, '0')
      WHERE id = ${updated.id} AND member_number IS NULL
      RETURNING member_number
    `;
    if (numbered.length) updated.member_number = numbered[0].member_number;
  }

  await sql`
    INSERT INTO customer_coupons (customer_id, coupon_id)
    SELECT ${updated.id}, id FROM coupons WHERE auto_grant = true AND active = true
    ON CONFLICT (customer_id, coupon_id) DO NOTHING
  `;

  try { await recordCodeAttempt(ip, true); } catch (e) { /* best effort */ }
  await notify(updated.id, 'Seu código foi ativado. Você agora é Membro Verité.');

  delete updated.password_hash;
  res.status(200).json({ ok: true, customer: updated });
};
