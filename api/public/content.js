const { sql } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const { rows } = await sql`SELECT key, value FROM content_blocks`;
  const content = {};
  rows.forEach((r) => { content[r.key] = r.value; });
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ ok: true, content });
};
