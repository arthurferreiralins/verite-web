const { sql } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const { rows } = await sql`SELECT instagram_url, whatsapp_number, contact_email FROM site_settings WHERE id = 1`;
  const row = rows[0] || {};
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    ok: true,
    settings: {
      instagramUrl: row.instagram_url || null,
      whatsappNumber: row.whatsapp_number || null,
      contactEmail: row.contact_email || null,
    },
  });
};
