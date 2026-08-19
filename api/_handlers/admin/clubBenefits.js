const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT b.*, t.name AS tier_name FROM club_benefits b LEFT JOIN club_tiers t ON t.id = b.tier_id
      ORDER BY b.sort_order ASC, b.id ASC
    `;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = str(body.name);
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    const { rows } = await sql`
      INSERT INTO club_benefits (name, description, tier_id, validity_note, sort_order, active)
      VALUES (${name}, ${str(body.description)}, ${body.tierId ? Number(body.tierId) : null}, ${str(body.validityNote)}, ${Number(body.sortOrder) || 0}, ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'club_benefit', entityId: rows[0].id, description: `Benefício "${name}" criado`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do benefício é obrigatório.' }); return; }
    const { rows: existingRows } = await sql`SELECT * FROM club_benefits WHERE id = ${id}`;
    if (!existingRows.length) { res.status(404).json({ ok: false, error: 'Benefício não encontrado.' }); return; }
    const existing = existingRows[0];
    const body = await readJsonBody(req);
    const name = body.name != null ? str(body.name) : existing.name;
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    const { rows } = await sql`
      UPDATE club_benefits SET
        name = ${name},
        description = ${body.description != null ? str(body.description) : existing.description},
        tier_id = ${body.tierId !== undefined ? (body.tierId ? Number(body.tierId) : null) : existing.tier_id},
        validity_note = ${body.validityNote != null ? str(body.validityNote) : existing.validity_note},
        sort_order = ${body.sortOrder !== undefined ? Number(body.sortOrder) || 0 : existing.sort_order},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active}
      WHERE id = ${id} RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'club_benefit', entityId: id, description: `Benefício "${rows[0].name}" atualizado`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do benefício é obrigatório.' }); return; }
    const { rows } = await sql`DELETE FROM club_benefits WHERE id = ${id} RETURNING name`;
    if (rows.length) await logActivity({ action: 'deleted', entityType: 'club_benefit', entityId: id, description: `Benefício "${rows[0].name}" excluído`, adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
