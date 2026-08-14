const { requireClubSession } = require('../../_lib/clubAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;
  res.status(200).json({ ok: true, customer });
};
