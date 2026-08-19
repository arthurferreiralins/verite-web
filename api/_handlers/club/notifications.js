const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');
const { readJsonBody } = require('../../_lib/readBody');

// GET: últimas notificações reais do cliente + contagem de não lidas.
// PUT: marca todas (ou uma, se {id} vier no corpo) como lidas.
module.exports = async function handler(req, res) {
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT * FROM club_notifications WHERE customer_id = ${customer.id} ORDER BY created_at DESC LIMIT 30
    `;
    const unread = rows.filter((n) => !n.read_at).length;
    res.status(200).json({ ok: true, items: rows, unread });
    return;
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    if (body.id) {
      await sql`UPDATE club_notifications SET read_at = now() WHERE id = ${Number(body.id)} AND customer_id = ${customer.id} AND read_at IS NULL`;
    } else {
      await sql`UPDATE club_notifications SET read_at = now() WHERE customer_id = ${customer.id} AND read_at IS NULL`;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
