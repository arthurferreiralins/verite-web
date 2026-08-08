const { getSession } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true, email: session.email });
};
