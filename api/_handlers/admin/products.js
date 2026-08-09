const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, isValidSlug, isValidPrice, slugify, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

// Fallback caso a tabela categories esteja vazia/inacessível — as 4
// categorias que já existem de verdade no site público hoje.
const LEGACY_CATEGORIES = ['perfumes', 'oleos-corporais', 'kits', 'novidades'];
const STATUSES = ['draft', 'published', 'archived'];

const OPTIONAL_TEXT_FIELDS = [
  ['productType', 'product_type'],
  ['concentration', 'concentration'],
  ['olfactoryFamily', 'olfactory_family'],
  ['notesTop', 'notes_top'],
  ['notesHeart', 'notes_heart'],
  ['notesBase', 'notes_base'],
  ['occasion', 'occasion'],
  ['intensity', 'intensity'],
  ['longevity', 'longevity'],
  ['sillage', 'sillage'],
  ['audience', 'audience'],
];

function stockStatus(row) {
  if (!row.track_stock) return null;
  if (row.stock_quantity <= 0) return 'esgotado';
  if (row.stock_quantity <= row.low_stock_threshold) return 'baixo';
  return 'em_estoque';
}
function withStockStatus(row) {
  return row ? { ...row, stock_status: stockStatus(row) } : row;
}

async function validCategories() {
  try {
    const { rows } = await sql`SELECT slug FROM categories WHERE active = true`;
    if (rows.length) return rows.map((r) => r.slug);
  } catch (e) {
    // segue pro fallback
  }
  return LEGACY_CATEGORIES;
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
      res.status(200).json({ ok: true, product: withStockStatus(rows[0]) });
      return;
    }
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
    const { rows } = statusFilter && STATUSES.includes(statusFilter)
      ? await sql`SELECT * FROM products WHERE status = ${statusFilter} ORDER BY sort_order ASC, created_at DESC`
      : await sql`SELECT * FROM products ORDER BY sort_order ASC, created_at DESC`;
    res.status(200).json({ ok: true, products: rows.map(withStockStatus) });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);

    // Duplicar um produto existente: copia tudo, gera novo slug/nome, sempre nasce rascunho.
    if (body.duplicateFrom) {
      const { rows: sourceRows } = await sql`SELECT * FROM products WHERE id = ${Number(body.duplicateFrom)}`;
      if (!sourceRows.length) {
        res.status(404).json({ ok: false, error: 'Produto de origem não encontrado.' });
        return;
      }
      const src = sourceRows[0];
      const newName = `${src.name} (cópia)`;
      const newSlug = await uniqueSlug(slugify(newName), null);
      const { rows } = await sql`
        INSERT INTO products
          (slug, name, category, short_description, description, price, sale_price, volume,
           main_image_url, gallery_urls, status, featured, sort_order, sku, stock_quantity,
           track_stock, low_stock_threshold, product_type, concentration, olfactory_family,
           notes_top, notes_heart, notes_base, occasion, intensity, longevity, sillage, audience)
        VALUES
          (${newSlug}, ${newName}, ${src.category}, ${src.short_description}, ${src.description},
           ${src.price}, ${src.sale_price}, ${src.volume}, ${src.main_image_url}, ${src.gallery_urls},
           'draft', false, ${src.sort_order}, ${null}, ${src.stock_quantity}, ${src.track_stock},
           ${src.low_stock_threshold}, ${src.product_type}, ${src.concentration}, ${src.olfactory_family},
           ${src.notes_top}, ${src.notes_heart}, ${src.notes_base}, ${src.occasion}, ${src.intensity},
           ${src.longevity}, ${src.sillage}, ${src.audience})
        RETURNING *
      `;
      await logActivity({ action: 'duplicated', entityType: 'product', entityId: rows[0].id, description: `Produto "${src.name}" duplicado`, adminEmail: session.email });
      res.status(201).json({ ok: true, product: withStockStatus(rows[0]) });
      return;
    }

    const name = str(body.name);
    const category = str(body.category);

    if (!isNonEmptyString(name, 200)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    if (!(await validCategories()).includes(category)) {
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
    const stockQty = Number.isFinite(Number(body.stockQuantity)) ? Math.max(0, Math.trunc(Number(body.stockQuantity))) : 0;
    const lowThreshold = Number.isFinite(Number(body.lowStockThreshold)) ? Math.max(0, Math.trunc(Number(body.lowStockThreshold))) : 5;
    const optionalValues = OPTIONAL_TEXT_FIELDS.map(([key]) => str(body[key]) || null);

    const { rows } = await sql`
      INSERT INTO products
        (slug, name, category, short_description, description, price, sale_price, volume, main_image_url, gallery_urls, status, featured, sort_order,
         sku, stock_quantity, track_stock, low_stock_threshold,
         product_type, concentration, olfactory_family, notes_top, notes_heart, notes_base, occasion, intensity, longevity, sillage, audience)
      VALUES
        (${slug}, ${name}, ${category}, ${str(body.shortDescription)}, ${str(body.description)},
         ${body.price === '' || body.price == null ? null : Number(body.price)},
         ${body.salePrice === '' || body.salePrice == null ? null : Number(body.salePrice)},
         ${str(body.volume)}, ${str(body.mainImageUrl) || null}, ${gallery},
         ${status}, ${Boolean(body.featured)}, ${Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0},
         ${str(body.sku) || null}, ${stockQty}, ${body.trackStock !== false}, ${lowThreshold},
         ${optionalValues[0]}, ${optionalValues[1]}, ${optionalValues[2]}, ${optionalValues[3]}, ${optionalValues[4]},
         ${optionalValues[5]}, ${optionalValues[6]}, ${optionalValues[7]}, ${optionalValues[8]}, ${optionalValues[9]})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'product', entityId: rows[0].id, description: `Produto "${name}" criado`, adminEmail: session.email });
    res.status(201).json({ ok: true, product: withStockStatus(rows[0]) });
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
    const body = await readJsonBody(req);

    const name = body.name != null ? str(body.name) : existing.name;
    const category = body.category != null ? str(body.category) : existing.category;
    if (!isNonEmptyString(name, 200)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    if (!(await validCategories()).includes(category)) {
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
    const stockQty = body.stockQuantity !== undefined
      ? (Number.isFinite(Number(body.stockQuantity)) ? Math.max(0, Math.trunc(Number(body.stockQuantity))) : existing.stock_quantity)
      : existing.stock_quantity;
    const lowThreshold = body.lowStockThreshold !== undefined
      ? (Number.isFinite(Number(body.lowStockThreshold)) ? Math.max(0, Math.trunc(Number(body.lowStockThreshold))) : existing.low_stock_threshold)
      : existing.low_stock_threshold;

    const optionalValues = OPTIONAL_TEXT_FIELDS.map(([key, col]) => (body[key] !== undefined ? (str(body[key]) || null) : existing[col]));

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
        sku = ${body.sku !== undefined ? (str(body.sku) || null) : existing.sku},
        stock_quantity = ${stockQty},
        track_stock = ${body.trackStock !== undefined ? Boolean(body.trackStock) : existing.track_stock},
        low_stock_threshold = ${lowThreshold},
        product_type = ${optionalValues[0]},
        concentration = ${optionalValues[1]},
        olfactory_family = ${optionalValues[2]},
        notes_top = ${optionalValues[3]},
        notes_heart = ${optionalValues[4]},
        notes_base = ${optionalValues[5]},
        occasion = ${optionalValues[6]},
        intensity = ${optionalValues[7]},
        longevity = ${optionalValues[8]},
        sillage = ${optionalValues[9]},
        audience = ${optionalValues[10]},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (status !== existing.status) {
      const verb = status === 'published' ? 'publicado' : status === 'archived' ? 'arquivado' : 'movido para rascunho';
      await logActivity({ action: 'status_changed', entityType: 'product', entityId: id, description: `Produto "${name}" ${verb}`, adminEmail: session.email });
    } else {
      await logActivity({ action: 'updated', entityType: 'product', entityId: id, description: `Produto "${name}" atualizado`, adminEmail: session.email });
    }
    res.status(200).json({ ok: true, product: withStockStatus(rows[0]) });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do produto é obrigatório.' });
      return;
    }
    const { rows } = await sql`DELETE FROM products WHERE id = ${id} RETURNING name`;
    if (rows.length) {
      await logActivity({ action: 'deleted', entityType: 'product', entityId: id, description: `Produto "${rows[0].name}" excluído`, adminEmail: session.email });
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
