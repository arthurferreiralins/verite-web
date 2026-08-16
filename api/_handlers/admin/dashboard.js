const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const [
    leadsResult, messagesResult, productsResult, ordersResult, customersResult, lowStockResult, activityResult,
    perfumesReadyResult, rawMaterialsResult, lowStockInventoryResult, monthlyProductionResult, monthlyProductionCostResult,
    inventoryValueResult, finishedValueResult, salesTotalResult, estimatedProfitResult,
  ] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM leads`,
    sql`SELECT status, count(*)::int AS n FROM messages GROUP BY status`,
    sql`SELECT status, count(*)::int AS n FROM products GROUP BY status`,
    sql`SELECT count(*)::int AS n FROM orders`,
    sql`SELECT count(*)::int AS n FROM customers`,
    sql`SELECT count(*)::int AS n FROM products WHERE track_stock = true AND status = 'published' AND stock_quantity <= low_stock_threshold`,
    sql`SELECT id, action, entity_type, description, admin_email, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 12`,
    sql`SELECT COALESCE(SUM(stock_quantity), 0)::int AS n FROM products WHERE track_stock = true`,
    sql`SELECT count(*)::int AS n FROM inventory_items WHERE type = 'materia_prima'`,
    sql`SELECT count(*)::int AS n FROM inventory_items WHERE min_threshold > 0 AND quantity <= min_threshold`,
    sql`SELECT count(*)::int AS n FROM production_batches WHERE production_date >= date_trunc('month', CURRENT_DATE)`,
    sql`SELECT COALESCE(SUM(production_cost), 0)::numeric AS n FROM production_batches WHERE production_date >= date_trunc('month', CURRENT_DATE)`,
    sql`SELECT COALESCE(SUM(quantity * unit_cost), 0)::numeric AS n FROM inventory_items`,
    sql`SELECT COALESCE(SUM(stock_quantity * (cost_essence + cost_base + cost_bottle + cost_cap + cost_label + cost_packaging)), 0)::numeric AS n FROM products WHERE track_stock = true`,
    sql`SELECT COALESCE(SUM(total), 0)::numeric AS n FROM orders WHERE status <> 'cancelado'`,
    sql`SELECT COALESCE(SUM(stock_quantity * (COALESCE(sale_price, price, 0) - (cost_essence + cost_base + cost_bottle + cost_cap + cost_label + cost_packaging))), 0)::numeric AS n FROM products WHERE track_stock = true`,
  ]);

  const messages = { novo: 0, lido: 0, respondido: 0, arquivado: 0 };
  messagesResult.rows.forEach((r) => { messages[r.status] = r.n; });

  const products = { draft: 0, published: 0, archived: 0 };
  productsResult.rows.forEach((r) => { products[r.status] = r.n; });

  res.status(200).json({
    ok: true,
    leads: leadsResult.rows[0].n,
    messages,
    messagesTotal: messages.novo + messages.lido + messages.respondido + messages.arquivado,
    products,
    productsTotal: products.draft + products.published + products.archived,
    orders: ordersResult.rows[0].n,
    customers: customersResult.rows[0].n,
    lowStock: lowStockResult.rows[0].n,
    activity: activityResult.rows,
    perfumesReady: perfumesReadyResult.rows[0].n,
    rawMaterials: rawMaterialsResult.rows[0].n,
    lowStockInventory: lowStockInventoryResult.rows[0].n,
    monthlyProductions: monthlyProductionResult.rows[0].n,
    monthlyProductionCost: Number(monthlyProductionCostResult.rows[0].n),
    inventoryValue: Number(inventoryValueResult.rows[0].n),
    finishedGoodsValue: Number(finishedValueResult.rows[0].n),
    salesTotal: Number(salesTotalResult.rows[0].n),
    estimatedProfit: Number(estimatedProfitResult.rows[0].n),
  });
};
