const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const [leadsResult, messagesResult, productsResult, ordersResult, lowStockResult, activityResult] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM leads`,
    sql`SELECT status, count(*)::int AS n FROM messages GROUP BY status`,
    sql`SELECT status, count(*)::int AS n FROM products GROUP BY status`,
    sql`SELECT count(*)::int AS n FROM orders`,
    sql`SELECT count(*)::int AS n FROM products WHERE track_stock = true AND status = 'published' AND stock_quantity <= low_stock_threshold`,
    sql`SELECT id, action, entity_type, description, admin_email, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 12`,
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
    lowStock: lowStockResult.rows[0].n,
    activity: activityResult.rows,
  });
};
