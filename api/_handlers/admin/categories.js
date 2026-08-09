const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, isValidSlug, slugify, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

async function uniqueSlug(base, ignoreId) {
  let candidate = base || 'categoria';
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = ignoreId
      ? await sql`SELECT id FROM categories WHERE slug = ${candidate} AND id <> ${ignoreId}`
      : await sql`SELECT id FROM categories WHERE slug = ${candidate}`;
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
    const { rows } = await sql`SELECT * FROM categories ORDER BY sort_order ASC, id ASC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = str(body.name);
    if (!isNonEmptyString(name, 100)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    let slug = str(body.slug) ? slugify(str(body.slug)) : slugify(name);
    if (!isValidSlug(slug)) slug = slugify(name) || 'categoria';
    slug = await uniqueSlug(slug, null);

    const { rows: maxRows } = await sql`SELECT COALESCE(max(sort_order), 0) + 1 AS n FROM categories`;
    const { rows } = await sql`
      INSERT INTO categories (name, slug, description, image_url, sort_order, active)
      VALUES (${name}, ${slug}, ${str(body.description)}, ${str(body.imageUrl) || null},
              ${Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : maxRows[0].n},
              ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'category', entityId: rows[0].id, description: `Categoria "${name}" criada`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);

    if (!id && Array.isArray(body.reorder)) {
      for (const entry of body.reorder) {
        if (!entry || !Number.isFinite(Number(entry.id))) continue;
        await sql`UPDATE categories SET sort_order = ${Number(entry.sortOrder) || 0}, updated_at = now() WHERE id = ${Number(entry.id)}`;
      }
      const { rows } = await sql`SELECT * FROM categories ORDER BY sort_order ASC, id ASC`;
      res.status(200).json({ ok: true, items: rows });
      return;
    }

    if (!id) {
      res.status(400).json({ ok: false, error: 'ID da categoria é obrigatório.' });
      return;
    }
    const { rows: existingRows } = await sql`SELECT * FROM categories WHERE id = ${id}`;
    if (!existingRows.length) {
      res.status(404).json({ ok: false, error: 'Categoria não encontrada.' });
      return;
    }
    const existing = existingRows[0];
    const name = body.name != null ? str(body.name) : existing.name;
    if (!isNonEmptyString(name, 100)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    let slug = existing.slug;
    if (body.slug != null && str(body.slug)) {
      const candidate = slugify(str(body.slug));
      if (isValidSlug(candidate) && candidate !== existing.slug) slug = await uniqueSlug(candidate, id);
    }
    const { rows } = await sql`
      UPDATE categories SET
        name = ${name},
        slug = ${slug},
        description = ${body.description != null ? str(body.description) : existing.description},
        image_url = ${body.imageUrl !== undefined ? (str(body.imageUrl) || null) : existing.image_url},
        sort_order = ${body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sort_order},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'category', entityId: id, description: `Categoria "${rows[0].name}" atualizada`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID da categoria é obrigatório.' });
      return;
    }
    const { rows: inUse } = await sql`SELECT count(*)::int AS n FROM products WHERE category = (SELECT slug FROM categories WHERE id = ${id})`;
    if (inUse[0] && inUse[0].n > 0) {
      res.status(409).json({ ok: false, error: 'Existem produtos usando esta categoria. Mova-os antes de excluir.' });
      return;
    }
    const { rows } = await sql`DELETE FROM categories WHERE id = ${id} RETURNING name`;
    if (rows.length) {
      await logActivity({ action: 'deleted', entityType: 'category', entityId: id, description: `Categoria "${rows[0].name}" excluída`, adminEmail: session.email });
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
