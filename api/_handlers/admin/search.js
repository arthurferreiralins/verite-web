const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');

// Busca global (seção 22) — consulta dados reais, nunca resultados fixos.
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.status(200).json({ ok: true, results: [] });
    return;
  }
  const like = `%${q}%`;

  const [products, leads, messages, customers, orders] = await Promise.all([
    sql`SELECT id, name FROM products WHERE name ILIKE ${like} OR sku ILIKE ${like} LIMIT 5`,
    sql`SELECT id, name, email FROM leads WHERE name ILIKE ${like} OR email ILIKE ${like} LIMIT 5`,
    sql`SELECT id, name, subject FROM messages WHERE name ILIKE ${like} OR email ILIKE ${like} OR subject ILIKE ${like} LIMIT 5`,
    sql`SELECT id, name, email FROM customers WHERE name ILIKE ${like} OR email ILIKE ${like} LIMIT 5`,
    sql`SELECT id, order_number, customer_name FROM orders WHERE order_number ILIKE ${like} OR customer_name ILIKE ${like} LIMIT 5`,
  ]);

  const results = [];
  products.rows.forEach((p) => results.push({ type: 'produto', route: 'produtos', id: p.id, label: p.name }));
  leads.rows.forEach((l) => results.push({ type: 'lista de espera', route: 'leads', id: l.id, label: `${l.name} (${l.email})` }));
  messages.rows.forEach((m) => results.push({ type: 'mensagem', route: 'mensagens', id: m.id, label: `${m.name}${m.subject ? ' — ' + m.subject : ''}` }));
  customers.rows.forEach((c) => results.push({ type: 'cliente', route: 'clientes', id: c.id, label: `${c.name} (${c.email})` }));
  orders.rows.forEach((o) => results.push({ type: 'pedido', route: 'pedidos', id: o.id, label: `${o.order_number} — ${o.customer_name}` }));

  res.status(200).json({ ok: true, results });
};
