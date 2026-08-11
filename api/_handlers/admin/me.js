const { requireAdminSession } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  res.status(200).json({ ok: true, email: session.email });
};
