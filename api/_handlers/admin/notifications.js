const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');

// Notificações são sempre derivadas de dados reais no momento da consulta
// (sem tabela de "lido/não lido" própria) — nunca inventadas.
module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const [messages, leads, lowStock] = await Promise.all([
    sql`SELECT id, name, subject, created_at FROM messages WHERE status = 'novo' ORDER BY created_at DESC LIMIT 8`,
    sql`SELECT id, name, created_at FROM leads WHERE created_at > now() - interval '7 days' ORDER BY created_at DESC LIMIT 8`,
    sql`SELECT id, name, stock_quantity FROM products WHERE track_stock = true AND status = 'published' AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC LIMIT 8`,
  ]);

  const items = [];
  messages.rows.forEach((m) => items.push({
    type: 'mensagem', id: m.id, text: `Nova mensagem de ${m.name}${m.subject ? ' — ' + m.subject : ''}`, createdAt: m.created_at,
  }));
  leads.rows.forEach((l) => items.push({
    type: 'lead', id: l.id, text: `${l.name} entrou na lista de espera`, createdAt: l.created_at,
  }));
  lowStock.rows.forEach((p) => items.push({
    type: 'estoque', id: p.id, text: `Estoque baixo: ${p.name} (${p.stock_quantity} un.)`, createdAt: null,
  }));
  items.sort((a, b) => (a.createdAt && b.createdAt ? new Date(b.createdAt) - new Date(a.createdAt) : 0));

  res.status(200).json({ ok: true, count: items.length, items });
};
