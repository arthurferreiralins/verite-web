const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (def || 0);
}

// Entrada/saída cobre tanto itens de estoque (matérias-primas, frascos,
// embalagens) quanto produtos prontos — mesma rota, mesma tabela de
// histórico (stock_movements), só troca qual tabela de quantidade é tocada.
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const itemType = req.query.itemType === 'product' ? 'product' : (req.query.itemType === 'inventory' ? 'inventory' : null);
    const itemId = req.query.itemId ? Number(req.query.itemId) : null;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const { rows } = itemType && itemId
      ? await sql`SELECT * FROM stock_movements WHERE item_type = ${itemType} AND item_id = ${itemId} ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT ${limit}`;
    res.status(200).json({ ok: true, movements: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const itemType = body.itemType === 'product' ? 'product' : (body.itemType === 'inventory' ? 'inventory' : null);
    const itemId = Number(body.itemId);
    const direction = body.direction === 'saida' ? 'saida' : 'entrada';
    const qty = Math.max(0, num(body.quantity));
    if (!itemType || !Number.isFinite(itemId) || qty <= 0) {
      res.status(400).json({ ok: false, error: 'Informe item e quantidade válidos.' });
      return;
    }

    const { rows: existingRows } = itemType === 'product'
      ? await sql`SELECT id, name, stock_quantity AS quantity FROM products WHERE id = ${itemId}`
      : await sql`SELECT id, name, quantity FROM inventory_items WHERE id = ${itemId}`;
    if (!existingRows.length) {
      res.status(404).json({ ok: false, error: 'Item não encontrado.' });
      return;
    }
    const existing = existingRows[0];
    const previous = Number(existing.quantity);
    const next = direction === 'entrada' ? previous + qty : Math.max(0, previous - qty);

    if (itemType === 'product') {
      await sql`UPDATE products SET stock_quantity = ${next}, updated_at = now() WHERE id = ${itemId}`;
    } else {
      await sql`UPDATE inventory_items SET quantity = ${next}, updated_at = now() WHERE id = ${itemId}`;
    }

    const reason = str(body.reason) || (direction === 'entrada' ? 'Entrada manual' : 'Saída manual');
    const { rows } = await sql`
      INSERT INTO stock_movements (item_type, item_id, item_name, direction, quantity, previous_stock, new_stock, reason, admin_email)
      VALUES (${itemType}, ${itemId}, ${existing.name}, ${direction}, ${qty}, ${previous}, ${next}, ${reason}, ${session.email})
      RETURNING *
    `;
    await logActivity({
      action: direction === 'entrada' ? 'stock_in' : 'stock_out',
      entityType: itemType,
      entityId: itemId,
      description: `${direction === 'entrada' ? 'Entrada' : 'Saída'} de estoque: "${existing.name}" (${qty})`,
      adminEmail: session.email,
    });
    res.status(201).json({ ok: true, movement: rows[0], newStock: next });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
