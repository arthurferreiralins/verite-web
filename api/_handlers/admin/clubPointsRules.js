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
    const { rows } = await sql`SELECT * FROM club_points_rules ORDER BY sort_order ASC, id ASC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const label = str(body.label);
    const pointsValue = Number(body.pointsValue);
    if (!isNonEmptyString(label, 160)) { res.status(400).json({ ok: false, error: 'Descrição da regra é obrigatória.' }); return; }
    if (!Number.isFinite(pointsValue) || !Number.isInteger(pointsValue)) { res.status(400).json({ ok: false, error: 'Quantidade de pontos inválida.' }); return; }
    const { rows } = await sql`
      INSERT INTO club_points_rules (label, points_value, description, sort_order, active)
      VALUES (${label}, ${pointsValue}, ${str(body.description)}, ${Number(body.sortOrder) || 0}, ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'club_points_rule', entityId: rows[0].id, description: `Regra de pontos "${label}" criada`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID da regra é obrigatório.' }); return; }
    const { rows: existingRows } = await sql`SELECT * FROM club_points_rules WHERE id = ${id}`;
    if (!existingRows.length) { res.status(404).json({ ok: false, error: 'Regra não encontrada.' }); return; }
    const existing = existingRows[0];
    const body = await readJsonBody(req);
    const label = body.label != null ? str(body.label) : existing.label;
    if (!isNonEmptyString(label, 160)) { res.status(400).json({ ok: false, error: 'Descrição da regra é obrigatória.' }); return; }
    const pointsValue = body.pointsValue !== undefined ? Number(body.pointsValue) : existing.points_value;
    if (!Number.isFinite(pointsValue) || !Number.isInteger(pointsValue)) { res.status(400).json({ ok: false, error: 'Quantidade de pontos inválida.' }); return; }
    const { rows } = await sql`
      UPDATE club_points_rules SET
        label = ${label}, points_value = ${pointsValue},
        description = ${body.description != null ? str(body.description) : existing.description},
        sort_order = ${body.sortOrder !== undefined ? Number(body.sortOrder) || 0 : existing.sort_order},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active}
      WHERE id = ${id} RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'club_points_rule', entityId: id, description: `Regra "${rows[0].label}" atualizada`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID da regra é obrigatório.' }); return; }
    const { rows } = await sql`DELETE FROM club_points_rules WHERE id = ${id} RETURNING label`;
    if (rows.length) await logActivity({ action: 'deleted', entityType: 'club_points_rule', entityId: id, description: `Regra "${rows[0].label}" excluída`, adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
