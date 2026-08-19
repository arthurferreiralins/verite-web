const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const { rows } = await sql`
    SELECT * FROM club_news WHERE active = true ORDER BY published_at DESC LIMIT 20
  `;
  res.status(200).json({ ok: true, items: rows });
};
