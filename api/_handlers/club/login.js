const { sql } = require('../../_lib/db');
const { verifyPassword, createSessionCookie } = require('../../_lib/clubAuth');
const { getClientIp, isClubLoginRateLimited, recordClubLoginAttempt } = require('../../_lib/rateLimit');
const { isValidEmail, isNonEmptyString } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const ip = getClientIp(req);
  const body = await readJsonBody(req);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !isNonEmptyString(password)) {
    res.status(400).json({ ok: false, error: 'Informe e-mail e senha.' });
    return;
  }

  try {
    if (await isClubLoginRateLimited(ip)) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
      return;
    }
  } catch (e) {
    // segue sem bloquear
  }

  const { rows } = await sql`SELECT * FROM customers WHERE email = ${email} AND password_hash IS NOT NULL`;
  const customer = rows[0];
  const ok = Boolean(customer) && verifyPassword(password, customer.password_hash);

  try { await recordClubLoginAttempt(ip, ok); } catch (e) { /* best effort */ }

  if (!ok) {
    res.status(401).json({ ok: false, error: 'E-mail ou senha inválidos.' });
    return;
  }

  res.setHeader('Set-Cookie', createSessionCookie(req, customer.id, customer.session_version));
  delete customer.password_hash;
  res.status(200).json({ ok: true, customer });
};
