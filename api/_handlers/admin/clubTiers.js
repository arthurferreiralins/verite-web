const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, isValidSlug, slugify, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

// Sem DELETE de propósito — um nível em uso não pode simplesmente sumir.
// Pra aposentar um nível, o admin desativa (active=false); ele para de
// aparecer na progressão mas nada quebra pra quem já estava nele.
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM club_tiers ORDER BY min_spent ASC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = str(body.name);
    if (!isNonEmptyString(name, 80)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    let slug = slugify(str(body.slug) || name);
    if (!isValidSlug(slug)) { res.status(400).json({ ok: false, error: 'Slug inválido.' }); return; }
    const minSpent = Number(body.minSpent);
    if (!Number.isFinite(minSpent) || minSpent < 0) {
      res.status(400).json({ ok: false, error: 'Valor mínimo de compras inválido.' });
      return;
    }
    const { rows } = await sql`
      INSERT INTO club_tiers (slug, name, min_spent, description, sort_order, active)
      VALUES (${slug}, ${name}, ${minSpent}, ${str(body.description)}, ${Number(body.sortOrder) || 0}, ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'club_tier', entityId: rows[0].id, description: `Nível "${name}" criado`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do nível é obrigatório.' }); return; }
    const { rows: existingRows } = await sql`SELECT * FROM club_tiers WHERE id = ${id}`;
    if (!existingRows.length) { res.status(404).json({ ok: false, error: 'Nível não encontrado.' }); return; }
    const existing = existingRows[0];
    const body = await readJsonBody(req);
    const name = body.name != null ? str(body.name) : existing.name;
    if (!isNonEmptyString(name, 80)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    const minSpent = body.minSpent !== undefined ? Number(body.minSpent) : Number(existing.min_spent);
    if (!Number.isFinite(minSpent) || minSpent < 0) { res.status(400).json({ ok: false, error: 'Valor mínimo inválido.' }); return; }
    const { rows } = await sql`
      UPDATE club_tiers SET
        name = ${name},
        min_spent = ${minSpent},
        description = ${body.description != null ? str(body.description) : existing.description},
        sort_order = ${body.sortOrder !== undefined ? Number(body.sortOrder) || 0 : existing.sort_order},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active}
      WHERE id = ${id} RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'club_tier', entityId: id, description: `Nível "${rows[0].name}" atualizado`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
