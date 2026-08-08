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

  if (str(body.website)) {
    res.status(200).json({ ok: true });
    return;
  }

  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const subject = str(body.subject);
  const message = str(body.message);

  if (!isNonEmptyString(name, 200) || !isValidEmail(email) || !isNonEmptyString(message, 5000)) {
    res.status(400).json({ ok: false, error: 'Preencha os campos obrigatórios corretamente.' });
    return;
  }

  const ip = getClientIp(req);
  try {
    if (await isSubmissionRateLimited(ip, 'contact')) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
      return;
    }
    await recordSubmissionAttempt(ip, 'contact');
  } catch (e) {
    // best effort
  }

  try {
    await sql`INSERT INTO messages (name, email, subject, message) VALUES (${name}, ${email}, ${subject}, ${message})`;
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Não foi possível enviar sua mensagem agora.' });
  }
};
