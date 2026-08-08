const { sql } = require('../../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const { rows } = await sql`
    SELECT slug, name, category, short_description, description, price, sale_price, volume, main_image_url, gallery_urls, featured
    FROM products
    WHERE status = 'published'
    ORDER BY featured DESC, sort_order ASC, created_at DESC
  `;

  const products = rows.map((p) => {
    const images = [];
    if (p.main_image_url) images.push(p.main_image_url);
    (p.gallery_urls || []).forEach((url) => { if (url && url !== p.main_image_url) images.push(url); });
    return {
      id: p.slug,
      name: p.name,
      category: p.category,
      shortDescription: p.short_description || '',
      description: p.description || '',
      volume: p.volume || '',
      price: p.price != null ? Number(p.price) : null,
      salePrice: p.sale_price != null ? Number(p.sale_price) : null,
      currency: 'BRL',
      images,
      relatedIds: [],
      buyUrl: null,
      featured: Boolean(p.featured),
    };
  });

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ ok: true, products });
};
