const { sql } = require('../../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const { rows } = await sql`
    SELECT id, question, answer FROM faq_items
    WHERE active = true
    ORDER BY sort_order ASC, id ASC
  `;
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ ok: true, items: rows });
};
