const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');
const { readJsonBody } = require('../../_lib/readBody');

// Favoritos referenciam o mesmo catálogo (products) da loja principal —
// mesmo produto, mesmo slug, sem tabela paralela.
module.exports = async function handler(req, res) {
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT p.slug, p.name, p.category, p.short_description, p.price, p.sale_price, p.main_image_url
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      WHERE f.customer_id = ${customer.id}
      ORDER BY f.created_at DESC
    `;
    res.status(200).json({ ok: true, items: rows });
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
