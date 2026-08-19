const { sql } = require('../../_lib/db');

const NEW_WINDOW_DAYS = 45;

// Público (não exige sessão) — reaproveita o mesmo catálogo da loja, com o
// MESMO formato de /api/public/products (nunca um catálogo paralelo), pra
// o Clube poder usar os mesmos cards premium (assets/js/products.js) da
// loja principal. ?kind=exclusivos -> club_exclusive=true; ?kind=novidades
// -> mais recentes publicados.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const kind = typeof req.query.kind === 'string' ? req.query.kind : 'novidades';

  let queryResult;
  if (kind === 'exclusivos') {
    queryResult = await sql`
      SELECT slug, name, category, short_description, description, price, sale_price, volume,
        main_image_url, gallery_urls, featured, seo_title, seo_description,
        audience, olfactory_family, notes_top, notes_heart, notes_base, concentration,
        occasion, intensity, longevity, sillage, bestseller, limited_edition, club_exclusive,
        sku, stock_quantity, track_stock, created_at
      FROM products WHERE status = 'published' AND club_exclusive = true
      ORDER BY created_at DESC
    `;
  } else if (kind === 'destaques') {
    queryResult = await sql`
      SELECT slug, name, category, short_description, description, price, sale_price, volume,
        main_image_url, gallery_urls, featured, seo_title, seo_description,
        audience, olfactory_family, notes_top, notes_heart, notes_base, concentration,
        occasion, intensity, longevity, sillage, bestseller, limited_edition, club_exclusive,
        sku, stock_quantity, track_stock, created_at
      FROM products WHERE status = 'published' AND featured = true
      ORDER BY created_at DESC LIMIT 8
    `;
  } else {
    queryResult = await sql`
      SELECT slug, name, category, short_description, description, price, sale_price, volume,
        main_image_url, gallery_urls, featured, seo_title, seo_description,
        audience, olfactory_family, notes_top, notes_heart, notes_base, concentration,
        occasion, intensity, longevity, sillage, bestseller, limited_edition, club_exclusive,
        sku, stock_quantity, track_stock, created_at
      FROM products WHERE status = 'published'
      ORDER BY created_at DESC LIMIT 8
    `;
  }
  const { rows } = queryResult;

  const now = Date.now();
  const genderMap = { feminino: 'feminino', masculino: 'masculino', unissex: 'unissex' };

  const products = rows.map((p) => {
    const images = [];
    if (p.main_image_url) images.push(p.main_image_url);
    (p.gallery_urls || []).forEach((url) => { if (url && url !== p.main_image_url) images.push(url); });
    const createdAt = p.created_at ? new Date(p.created_at) : null;
    const isNew = createdAt ? (now - createdAt.getTime()) / 86400000 <= NEW_WINDOW_DAYS : false;
    const inStock = !p.track_stock || p.stock_quantity > 0;
    const gender = p.audience ? genderMap[String(p.audience).toLowerCase()] || null : null;
    return {
      id: p.slug, slug: p.slug, name: p.name, category: p.category, gender,
      shortDescription: p.short_description || '', description: p.description || '',
      volume: p.volume || '', sku: p.sku || '',
      price: p.price != null ? Number(p.price) : null,
      salePrice: p.sale_price != null ? Number(p.sale_price) : null,
      currency: 'BRL', images, relatedIds: [], buyUrl: null,
      featured: Boolean(p.featured), bestseller: Boolean(p.bestseller),
      limitedEdition: Boolean(p.limited_edition), clubExclusive: Boolean(p.club_exclusive),
      isNew, inStock,
      olfactoryFamily: p.olfactory_family || '', notesTop: p.notes_top || '',
      notesHeart: p.notes_heart || '', notesBase: p.notes_base || '',
      concentration: p.concentration || '', occasion: p.occasion || '',
      intensity: p.intensity || '', longevity: p.longevity || '', sillage: p.sillage || '',
      createdAt: createdAt ? createdAt.toISOString() : null,
      seoTitle: p.seo_title || '', seoDescription: p.seo_description || '',
    };
  });

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ ok: true, items: products, products });
};
