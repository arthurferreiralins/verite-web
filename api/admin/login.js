const { verifyPassword, createSessionCookie } = require('../_lib/auth');
const { getClientIp, isLoginRateLimited, recordLoginAttempt } = require('../_lib/rateLimit');
const { isValidEmail, isNonEmptyString } = require('../_lib/validate');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const ip = getClientIp(req);
  const body = parseBody(req);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !isNonEmptyString(password)) {
    res.status(400).json({ ok: false, error: 'Informe e-mail e senha.' });
    return;
  }

  try {
    if (await isLoginRateLimited(ip)) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
      return;
    }
  } catch (e) {
    // If the rate-limit table isn't reachable yet, don't block login attempts because of it.
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD_HASH || '';
  const ok = Boolean(adminEmail) && email === adminEmail && verifyPassword(password, adminHash);

  try {
    await recordLoginAttempt(ip, ok);
  } catch (e) {
    // best effort — never fail the login flow because logging the attempt failed
  }

  if (!ok) {
    res.status(401).json({ ok: false, error: 'Credenciais inválidas.' });
    return;
  }

  res.setHeader('Set-Cookie', createSessionCookie(req, adminEmail));
  res.status(200).json({ ok: true });
};
