const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');

// Sem checkout real na loja ainda (ver db/schema.sql) — esta rota já
// funciona de ponta a ponta, só que fica vazia até um pedido de verdade
// existir. Nenhum dado é inventado aqui.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const { rows } = await sql`
    SELECT order_number, items, total, payment_method, status, created_at
    FROM orders WHERE customer_id = ${customer.id}
    ORDER BY created_at DESC
  `;
  res.status(200).json({ ok: true, items: rows });
};
