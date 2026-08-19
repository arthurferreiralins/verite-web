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
    const { rows } = await sql`SELECT * FROM club_rewards ORDER BY points_cost ASC, id ASC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = str(body.name);
    const pointsCost = Number(body.pointsCost);
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    if (!Number.isFinite(pointsCost) || pointsCost <= 0) { res.status(400).json({ ok: false, error: 'Custo em pontos inválido.' }); return; }
    const { rows } = await sql`
      INSERT INTO club_rewards (name, points_cost, description, sort_order, active)
      VALUES (${name}, ${pointsCost}, ${str(body.description)}, ${Number(body.sortOrder) || 0}, ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'club_reward', entityId: rows[0].id, description: `Recompensa "${name}" criada`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID da recompensa é obrigatório.' }); return; }
    const { rows: existingRows } = await sql`SELECT * FROM club_rewards WHERE id = ${id}`;
    if (!existingRows.length) { res.status(404).json({ ok: false, error: 'Recompensa não encontrada.' }); return; }
    const existing = existingRows[0];
    const body = await readJsonBody(req);
    const name = body.name != null ? str(body.name) : existing.name;
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    const pointsCost = body.pointsCost !== undefined ? Number(body.pointsCost) : Number(existing.points_cost);
    if (!Number.isFinite(pointsCost) || pointsCost <= 0) { res.status(400).json({ ok: false, error: 'Custo em pontos inválido.' }); return; }
    const { rows } = await sql`
      UPDATE club_rewards SET
        name = ${name}, points_cost = ${pointsCost},
        description = ${body.description != null ? str(body.description) : existing.description},
        sort_order = ${body.sortOrder !== undefined ? Number(body.sortOrder) || 0 : existing.sort_order},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active}
      WHERE id = ${id} RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'club_reward', entityId: id, description: `Recompensa "${rows[0].name}" atualizada`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID da recompensa é obrigatório.' }); return; }
    const { rows } = await sql`DELETE FROM club_rewards WHERE id = ${id} RETURNING name`;
    if (rows.length) await logActivity({ action: 'deleted', entityType: 'club_reward', entityId: id, description: `Recompensa "${rows[0].name}" excluída`, adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
