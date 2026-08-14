const { sql } = require('../../_lib/db');

// Público (não exige sessão) — reaproveita o mesmo catálogo da loja.
// ?kind=exclusivos -> produtos marcados club_exclusive; ?kind=novidades ->
// os mais recentes publicados. Sempre o catálogo real, nunca dados à parte.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const kind = typeof req.query.kind === 'string' ? req.query.kind : 'novidades';

  const { rows } = kind === 'exclusivos'
    ? await sql`
        SELECT slug, name, category, short_description, price, sale_price, main_image_url, created_at
        FROM products WHERE status = 'published' AND club_exclusive = true
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT slug, name, category, short_description, price, sale_price, main_image_url, created_at
        FROM products WHERE status = 'published'
        ORDER BY created_at DESC LIMIT 8
      `;

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ ok: true, items: rows });
};
