const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

const TYPES = ['materia_prima', 'frasco', 'embalagem'];
const UNITS = ['ml', 'un'];

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (def || 0);
}

// Três níveis a partir de um único limite mínimo configurável por item:
// OK acima do mínimo, baixo entre o mínimo e metade dele, crítico abaixo
// da metade (ou zerado). Mantém a UI simples de configurar (um campo só).
function alertLevel(item) {
  const qty = Number(item.quantity);
  const min = Number(item.min_threshold);
  if (min <= 0) return 'ok';
  if (qty <= min * 0.5) return 'critico';
  if (qty <= min) return 'baixo';
  return 'ok';
}
function withAlert(row) {
  return row ? { ...row, alert_level: alertLevel(row) } : row;
}

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const typeFilter = typeof req.query.type === 'string' && TYPES.includes(req.query.type) ? req.query.type : null;
    const { rows } = typeFilter
      ? await sql`SELECT * FROM inventory_items WHERE type = ${typeFilter} ORDER BY name ASC`
      : await sql`SELECT * FROM inventory_items ORDER BY type ASC, name ASC`;
    res.status(200).json({ ok: true, items: rows.map(withAlert) });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const type = TYPES.includes(body.type) ? body.type : null;
    const name = str(body.name);
    if (!type) {
      res.status(400).json({ ok: false, error: 'Tipo de item inválido.' });
      return;
    }
    if (!isNonEmptyString(name, 150)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    const unit = UNITS.includes(body.unit) ? body.unit : 'un';
    const quantity = Math.max(0, num(body.quantity));
    const unitCost = Math.max(0, num(body.unitCost));
    const minThreshold = Math.max(0, num(body.minThreshold));

    const { rows } = await sql`
      INSERT INTO inventory_items (type, subtype, name, unit, quantity, unit_cost, min_threshold, notes)
      VALUES (${type}, ${str(body.subtype)}, ${name}, ${unit}, ${quantity}, ${unitCost}, ${minThreshold}, ${str(body.notes)})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'inventory_item', entityId: rows[0].id, description: `Item de estoque "${name}" criado`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: withAlert(rows[0]) });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do item é obrigatório.' });
      return;
    }
    const { rows: existingRows } = await sql`SELECT * FROM inventory_items WHERE id = ${id}`;
    if (!existingRows.length) {
      res.status(404).json({ ok: false, error: 'Item não encontrado.' });
      return;
    }
    const existing = existingRows[0];
    const body = await readJsonBody(req);

    const name = body.name != null ? str(body.name) : existing.name;
    if (!isNonEmptyString(name, 150)) {
      res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      return;
    }
    const type = body.type != null && TYPES.includes(body.type) ? body.type : existing.type;
    const unit = body.unit != null && UNITS.includes(body.unit) ? body.unit : existing.unit;

    const { rows } = await sql`
      UPDATE inventory_items SET
        type = ${type},
        subtype = ${body.subtype != null ? str(body.subtype) : existing.subtype},
        name = ${name},
        unit = ${unit},
        unit_cost = ${body.unitCost !== undefined ? Math.max(0, num(body.unitCost)) : existing.unit_cost},
        min_threshold = ${body.minThreshold !== undefined ? Math.max(0, num(body.minThreshold)) : existing.min_threshold},
        notes = ${body.notes != null ? str(body.notes) : existing.notes},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'inventory_item', entityId: id, description: `Item de estoque "${rows[0].name}" atualizado`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: withAlert(rows[0]) });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do item é obrigatório.' });
      return;
    }
    const { rows } = await sql`DELETE FROM inventory_items WHERE id = ${id} RETURNING name`;
    if (rows.length) {
      await logActivity({ action: 'deleted', entityType: 'inventory_item', entityId: id, description: `Item de estoque "${rows[0].name}" excluído`, adminEmail: session.email });
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
