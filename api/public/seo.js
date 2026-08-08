const { sql } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const { rows } = await sql`SELECT site_title, meta_description, share_image_url FROM seo_settings WHERE id = 1`;
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ ok: true, seo: rows[0] || {} });
};
