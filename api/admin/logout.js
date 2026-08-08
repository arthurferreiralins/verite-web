const { clearSessionCookie } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  res.status(200).json({ ok: true });
};
