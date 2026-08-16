const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

const STATUSES = ['produzindo', 'macerando', 'pronto', 'esgotado'];

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (def || 0);
}

async function nextLoteCode() {
  const { rows } = await sql`SELECT lote_code FROM production_batches ORDER BY id DESC LIMIT 1`;
  let n = 1;
  if (rows.length) {
    const m = /VT-LD-(\d+)/.exec(rows[0].lote_code);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return 'VT-LD-' + String(n).padStart(3, '0');
}

async function fetchInventoryItem(id) {
  if (!Number.isFinite(Number(id))) return null;
  const { rows } = await sql`SELECT * FROM inventory_items WHERE id = ${Number(id)}`;
  return rows[0] || null;
}

// Desconta um item de estoque e grava a movimentação correspondente.
// Best-effort sobre quantidade negativa: nunca deixa o estoque abaixo de 0,
// mesmo que a produção informada exceda o que existe fisicamente registrado.
async function deductInventory(item, qty, loteCode, adminEmail) {
  if (!item || qty <= 0) return;
  const previous = Number(item.quantity);
  const next = Math.max(0, previous - qty);
  await sql`UPDATE inventory_items SET quantity = ${next}, updated_at = now() WHERE id = ${item.id}`;
  await sql`
    INSERT INTO stock_movements (item_type, item_id, item_name, direction, quantity, previous_stock, new_stock, reason, admin_email)
    VALUES ('inventory', ${item.id}, ${item.name}, 'saida', ${qty}, ${previous}, ${next}, ${'Produção ' + loteCode}, ${adminEmail})
  `;
}

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    if (id) {
      const { rows } = await sql`SELECT * FROM production_batches WHERE id = ${id}`;
      if (!rows.length) {
        res.status(404).json({ ok: false, error: 'Lote não encontrado.' });
        return;
      }
      res.status(200).json({ ok: true, batch: rows[0] });
      return;
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const statusFilter = typeof req.query.status === 'string' && STATUSES.includes(req.query.status) ? req.query.status : '';
    const like = '%' + q + '%';
    let rows;
    if (q && statusFilter) {
      ({ rows } = await sql`SELECT * FROM production_batches WHERE status = ${statusFilter} AND (lote_code ILIKE ${like} OR perfume_name ILIKE ${like}) ORDER BY created_at DESC`);
    } else if (q) {
      ({ rows } = await sql`SELECT * FROM production_batches WHERE lote_code ILIKE ${like} OR perfume_name ILIKE ${like} ORDER BY created_at DESC`);
    } else if (statusFilter) {
      ({ rows } = await sql`SELECT * FROM production_batches WHERE status = ${statusFilter} ORDER BY created_at DESC`);
    } else {
      ({ rows } = await sql`SELECT * FROM production_batches ORDER BY created_at DESC`);
    }
    res.status(200).json({ ok: true, batches: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const productId = Number(body.productId);
    if (!Number.isFinite(productId)) {
      res.status(400).json({ ok: false, error: 'Selecione o perfume.' });
      return;
    }
    const { rows: prodRows } = await sql`SELECT * FROM products WHERE id = ${productId}`;
    if (!prodRows.length) {
      res.status(404).json({ ok: false, error: 'Perfume não encontrado.' });
      return;
    }
    const product = prodRows[0];

    const essenceMl = Math.max(0, num(body.essenceMl));
    const baseMl = Math.max(0, num(body.baseMl));
    const otherIngredients = Array.isArray(body.otherIngredients)
      ? body.otherIngredients.filter((i) => i && str(i.name)).map((i) => ({
        itemId: Number.isFinite(Number(i.itemId)) ? Number(i.itemId) : null,
        name: str(i.name),
        qty: Math.max(0, num(i.qty)),
        unitCost: Math.max(0, num(i.unitCost)),
      }))
      : [];
    const otherMlSum = otherIngredients.reduce((s, i) => s + i.qty, 0);
    const totalVolume = body.totalVolumeMl !== undefined && body.totalVolumeMl !== ''
      ? Math.max(0, num(body.totalVolumeMl))
      : (essenceMl + baseMl + otherMlSum);
    const bottleSize = Math.max(0, num(body.bottleSizeMl));
    const bottleCount = bottleSize > 0 ? Math.floor(totalVolume / bottleSize) : 0;

    const essenceItem = await fetchInventoryItem(body.essenceItemId);
    const baseItem = await fetchInventoryItem(body.baseItemId);
    const bottleItem = await fetchInventoryItem(body.bottleItemId);

    // Custo calculado a partir do custo unitário dos itens de estoque
    // selecionados, mas o campo aceita sobrescrita manual (body.productionCost).
    let computedCost = 0;
    if (essenceItem) computedCost += essenceMl * Number(essenceItem.unit_cost);
    if (baseItem) computedCost += baseMl * Number(baseItem.unit_cost);
    otherIngredients.forEach((i) => { computedCost += i.qty * i.unitCost; });
    if (bottleItem) computedCost += bottleCount * Number(bottleItem.unit_cost);
    const productionCost = body.productionCost !== undefined && body.productionCost !== ''
      ? Math.max(0, num(body.productionCost))
      : computedCost;

    const loteCode = await nextLoteCode();
    const status = STATUSES.includes(body.status) && body.status !== 'esgotado' ? body.status : 'produzindo';
    const productionDate = str(body.productionDate) || new Date().toISOString().slice(0, 10);

    const { rows } = await sql`
      INSERT INTO production_batches
        (lote_code, product_id, perfume_name, production_date, essence_item_id, essence_name, essence_ml,
         base_item_id, base_name, base_ml, other_ingredients, total_volume_ml, bottle_size_ml,
         bottle_item_id, bottle_name, bottle_count, production_cost, notes, status)
      VALUES
        (${loteCode}, ${productId}, ${product.name}, ${productionDate},
         ${essenceItem ? essenceItem.id : null}, ${essenceItem ? essenceItem.name : str(body.essenceName)}, ${essenceMl},
         ${baseItem ? baseItem.id : null}, ${baseItem ? baseItem.name : str(body.baseName)}, ${baseMl},
         ${JSON.stringify(otherIngredients)}, ${totalVolume}, ${bottleSize},
         ${bottleItem ? bottleItem.id : null}, ${bottleItem ? bottleItem.name : str(body.bottleName)}, ${bottleCount},
         ${productionCost}, ${str(body.notes)}, ${status})
      RETURNING *
    `;
    let batch = rows[0];

    await deductInventory(essenceItem, essenceMl, loteCode, session.email);
    await deductInventory(baseItem, baseMl, loteCode, session.email);
    await deductInventory(bottleItem, bottleCount, loteCode, session.email);
    for (const ing of otherIngredients) {
      if (ing.itemId) {
        const item = await fetchInventoryItem(ing.itemId);
        await deductInventory(item, ing.qty, loteCode, session.email);
      }
    }

    if (status === 'pronto' && bottleCount > 0) {
      const newProdStock = Number(product.stock_quantity) + bottleCount;
      await sql`UPDATE products SET stock_quantity = ${newProdStock}, updated_at = now() WHERE id = ${productId}`;
      await sql`
        INSERT INTO stock_movements (item_type, item_id, item_name, direction, quantity, previous_stock, new_stock, reason, admin_email)
        VALUES ('product', ${productId}, ${product.name}, 'entrada', ${bottleCount}, ${product.stock_quantity}, ${newProdStock}, ${'Produção ' + loteCode}, ${session.email})
      `;
      const { rows: updated } = await sql`UPDATE production_batches SET stock_applied = true WHERE id = ${batch.id} RETURNING *`;
      batch = updated[0];
    }

    await logActivity({
      action: 'created',
      entityType: 'production_batch',
      entityId: batch.id,
      description: `Lote "${loteCode}" de "${product.name}" registrado (${bottleCount} frasco(s))`,
      adminEmail: session.email,
    });
    res.status(201).json({ ok: true, batch });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do lote é obrigatório.' });
      return;
    }
    const { rows: existingRows } = await sql`SELECT * FROM production_batches WHERE id = ${id}`;
    if (!existingRows.length) {
      res.status(404).json({ ok: false, error: 'Lote não encontrado.' });
      return;
    }
    const existing = existingRows[0];
    const body = await readJsonBody(req);

    const status = body.status != null && STATUSES.includes(body.status) ? body.status : existing.status;
    const notes = body.notes != null ? str(body.notes) : existing.notes;
    let stockApplied = existing.stock_applied;

    if (status === 'pronto' && !existing.stock_applied && existing.bottle_count > 0) {
      const { rows: prodRows } = await sql`SELECT * FROM products WHERE id = ${existing.product_id}`;
      if (prodRows.length) {
        const product = prodRows[0];
        const newProdStock = Number(product.stock_quantity) + Number(existing.bottle_count);
        await sql`UPDATE products SET stock_quantity = ${newProdStock}, updated_at = now() WHERE id = ${product.id}`;
        await sql`
          INSERT INTO stock_movements (item_type, item_id, item_name, direction, quantity, previous_stock, new_stock, reason, admin_email)
          VALUES ('product', ${product.id}, ${product.name}, 'entrada', ${existing.bottle_count}, ${product.stock_quantity}, ${newProdStock}, ${'Produção ' + existing.lote_code + ' pronta'}, ${session.email})
        `;
      }
      stockApplied = true;
    }

    const { rows } = await sql`
      UPDATE production_batches SET
        status = ${status},
        notes = ${notes},
        stock_applied = ${stockApplied},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (status !== existing.status) {
      await logActivity({ action: 'status_changed', entityType: 'production_batch', entityId: id, description: `Lote "${existing.lote_code}" alterado para "${status}"`, adminEmail: session.email });
    } else {
      await logActivity({ action: 'updated', entityType: 'production_batch', entityId: id, description: `Lote "${existing.lote_code}" atualizado`, adminEmail: session.email });
    }
    res.status(200).json({ ok: true, batch: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
