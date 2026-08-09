const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

// Estrutura pronta para o futuro (seção 12/34/35 do pedido) — sem checkout
// real hoje, então esta rota nunca cria pedidos; só lista/atualiza status
// de pedidos que vierem a existir por outro canal.
const STATUSES = ['novo', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado'];

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do pedido é obrigatório.' });
      return;
    }
    const body = await readJsonBody(req);
    if (!STATUSES.includes(body.status)) {
      res.status(400).json({ ok: false, error: 'Status inválido.' });
      return;
    }
    const { rows } = await sql`UPDATE orders SET status = ${body.status}, updated_at = now() WHERE id = ${id} RETURNING *`;
    if (!rows.length) {
      res.status(404).json({ ok: false, error: 'Pedido não encontrado.' });
      return;
    }
    await logActivity({ action: 'updated', entityType: 'order', entityId: id, description: `Pedido ${rows[0].order_number} marcado como ${body.status}`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
