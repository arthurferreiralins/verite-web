const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');
const { readJsonBody } = require('../../_lib/readBody');

const NEW_WINDOW_DAYS = 45;

// Favoritos referenciam o mesmo catálogo (products) da loja principal —
// mesmo produto, mesmo slug, sem tabela paralela.
module.exports = async function handler(req, res) {
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT p.slug, p.name, p.category, p.short_description, p.description, p.price, p.sale_price, p.volume,
        p.main_image_url, p.gallery_urls, p.featured, p.audience, p.olfactory_family,
        p.bestseller, p.limited_edition, p.club_exclusive, p.sku, p.stock_quantity, p.track_stock, p.created_at
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      WHERE f.customer_id = ${customer.id}
      ORDER BY f.created_at DESC
    `;
    const now = Date.now();
    const genderMap = { feminino: 'feminino', masculino: 'masculino', unissex: 'unissex' };
    const items = rows.map((p) => {
      const images = [];
      if (p.main_image_url) images.push(p.main_image_url);
      (p.gallery_urls || []).forEach((url) => { if (url && url !== p.main_image_url) images.push(url); });
      const createdAt = p.created_at ? new Date(p.created_at) : null;
      return {
        id: p.slug, slug: p.slug, name: p.name, category: p.category,
        gender: p.audience ? genderMap[String(p.audience).toLowerCase()] || null : null,
        shortDescription: p.short_description || '', description: p.description || '',
        volume: p.volume || '', sku: p.sku || '',
        price: p.price != null ? Number(p.price) : null,
        salePrice: p.sale_price != null ? Number(p.sale_price) : null,
        currency: 'BRL', images, relatedIds: [], buyUrl: null,
        featured: Boolean(p.featured), bestseller: Boolean(p.bestseller),
        limitedEdition: Boolean(p.limited_edition), clubExclusive: Boolean(p.club_exclusive),
        isNew: createdAt ? (now - createdAt.getTime()) / 86400000 <= NEW_WINDOW_DAYS : false,
        inStock: !p.track_stock || p.stock_quantity > 0,
        olfactoryFamily: p.olfactory_family || '',
        main_image_url: p.main_image_url, // compat: código antigo (productMiniCard) ainda lê esse campo
      };
    });
    res.status(200).json({ ok: true, items });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!slug) {
      res.status(400).json({ ok: false, error: 'Produto inválido.' });
      return;
    }
    const { rows: productRows } = await sql`SELECT id FROM products WHERE slug = ${slug} AND status = 'published'`;
    if (!productRows.length) {
      res.status(404).json({ ok: false, error: 'Produto não encontrado.' });
      return;
    }
    await sql`
      INSERT INTO favorites (customer_id, product_id) VALUES (${customer.id}, ${productRows[0].id})
      ON CONFLICT (customer_id, product_id) DO NOTHING
    `;
    res.status(201).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    if (!slug) {
      res.status(400).json({ ok: false, error: 'Produto inválido.' });
      return;
    }
    await sql`
      DELETE FROM favorites WHERE customer_id = ${customer.id}
        AND product_id = (SELECT id FROM products WHERE slug = ${slug})
    `;
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
