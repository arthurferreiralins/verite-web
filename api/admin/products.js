const { sql } = require('../_lib/db');
const { requireAdminSession } = require('../_lib/auth');
const { isNonEmptyString, isValidSlug, isValidPrice, slugify, str } = require('../_lib/validate');

const CATEGORIES = ['perfumes', 'oleos-corporais', 'kits', 'novidades'];
const STATUSES = ['draft', 'published'];

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

async function uniqueSlug(base, ignoreId) {
  let candidate = base || 'produto';
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = ignoreId
      ? await sql`SELECT id FROM products WHERE slug = ${candidate} AND id <> ${ignoreId}`
      : await sql`SELECT id FROM products WHERE slug = ${candidate}`;
    if (!rows.length) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    if (id) {
      const { rows } = await sql`SELECT * FROM products WHERE id = ${id}`;
      if (!rows.length) {
        res.status(404).json({ ok: false, error: 'Produto não encontrado.' });
        return;
      }
      res.status(200).json({ ok: true, product: rows[0] });
      return;
    }
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
    const { rows } = statusFilter && STATUSES.includes(statusFilter)
      ? await sql`SELECT * FROM products WHERE status = ${statusFilter} ORDER BY sort_order ASC, created_at DESC`
      : await sql`SELECT * FROM products ORDER BY sort_order ASC, created_at DESC`;
    res.status(200).json({ ok: true, products: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const name = str(body.name);
    const category = str(body.category);

    if (!isNonEmptyString(name, 200)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    if (!CATEGORIES.includes(category)) {
      res.status(400).json({ ok: false, error: 'Categoria inválida.' });
      return;
    }
    if (!isValidPrice(body.price) || !isValidPrice(body.salePrice)) {
      res.status(400).json({ ok: false, error: 'Preço inválido.' });
      return;
    }

    let slug = str(body.slug) ? slugify(str(body.slug)) : slugify(name);
    if (!isValidSlug(slug)) slug = slugify(name) || 'produto';
    slug = await uniqueSlug(slug, null);

    const status = STATUSES.includes(body.status) ? body.status : 'draft';
    const gallery = Array.isArray(body.gallery) ? body.gallery.filter((s) => typeof s === 'string') : [];

    const { rows } = await sql`
      INSERT INTO products
        (slug, name, category, short_description, description, price, sale_price, volume, main_image_url, gallery_urls, status, featured, sort_order)
      VALUES
        (${slug}, ${name}, ${category}, ${str(body.shortDescription)}, ${str(body.description)},
         ${body.price === '' || body.price == null ? null : Number(body.price)},
         ${body.salePrice === '' || body.salePrice == null ? null : Number(body.salePrice)},
         ${str(body.volume)}, ${str(body.mainImageUrl) || null}, ${gallery},
         ${status}, ${Boolean(body.featured)}, ${Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0})
      RETURNING *
    `;
    res.status(201).json({ ok: true, product: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do produto é obrigatório.' });
      return;
    }
    const { rows: existingRows } = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (!existingRows.length) {
      res.status(404).json({ ok: false, error: 'Produto não encontrado.' });
      return;
    }
    const existing = existingRows[0];
    const body = parseBody(req);

    const name = body.name != null ? str(body.name) : existing.name;
    const category = body.category != null ? str(body.category) : existing.category;
    if (!isNonEmptyString(name, 200)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    if (!CATEGORIES.includes(category)) {
      res.status(400).json({ ok: false, error: 'Categoria inválida.' });
      return;
    }
    if (!isValidPrice(body.price) || !isValidPrice(body.salePrice)) {
      res.status(400).json({ ok: false, error: 'Preço inválido.' });
      return;
    }

    let slug = existing.slug;
    if (body.slug != null && str(body.slug)) {
      const candidate = slugify(str(body.slug));
      if (isValidSlug(candidate) && candidate !== existing.slug) {
        slug = await uniqueSlug(candidate, id);
      }
    }

    const status = body.status != null && STATUSES.includes(body.status) ? body.status : existing.status;
    const gallery = Array.isArray(body.gallery) ? body.gallery.filter((s) => typeof s === 'string') : existing.gallery_urls;

    const price = body.price !== undefined ? (body.price === '' || body.price == null ? null : Number(body.price)) : existing.price;
    const salePrice = body.salePrice !== undefined ? (body.salePrice === '' || body.salePrice == null ? null : Number(body.salePrice)) : existing.sale_price;

    const { rows } = await sql`
      UPDATE products SET
        slug = ${slug},
        name = ${name},
        category = ${category},
        short_description = ${body.shortDescription != null ? str(body.shortDescription) : existing.short_description},
        description = ${body.description != null ? str(body.description) : existing.description},
        price = ${price},
        sale_price = ${salePrice},
        volume = ${body.volume != null ? str(body.volume) : existing.volume},
        main_image_url = ${body.mainImageUrl !== undefined ? (str(body.mainImageUrl) || null) : existing.main_image_url},
        gallery_urls = ${gallery},
        status = ${status},
        featured = ${body.featured !== undefined ? Boolean(body.featured) : existing.featured},
        sort_order = ${body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sort_order},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    res.status(200).json({ ok: true, product: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do produto é obrigatório.' });
      return;
    }
    await sql`DELETE FROM products WHERE id = ${id}`;
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
