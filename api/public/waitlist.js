const { sql } = require('../_lib/db');
const { getClientIp, isSubmissionRateLimited, recordSubmissionAttempt } = require('../_lib/rateLimit');
const { isValidEmail, isNonEmptyString, str } = require('../_lib/validate');

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

  const body = parseBody(req);

  // Honeypot: real users never fill a hidden field named "website".
  if (str(body.website)) {
    res.status(200).json({ ok: true });
    return;
  }

  const name = str(body.name);
  const email = str(body.email).toLowerCase();

  if (!isNonEmptyString(name, 200) || !isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'Preencha nome e e-mail corretamente.' });
    return;
  }

  const ip = getClientIp(req);
  try {
    if (await isSubmissionRateLimited(ip, 'waitlist')) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
      return;
    }
    await recordSubmissionAttempt(ip, 'waitlist');
  } catch (e) {
    // best effort rate limiting; never block a legitimate signup because of it
  }

  try {
    await sql`INSERT INTO leads (name, email) VALUES (${name}, ${email}) ON CONFLICT (email) DO NOTHING`;
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Não foi possível processar seu cadastro agora.' });
  }
};
