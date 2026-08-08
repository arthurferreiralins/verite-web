const { sql } = require('../_lib/db');
const { requireAdminSession } = require('../_lib/auth');

const STATUSES = ['novo', 'lido', 'respondido'];

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
    const { rows } = statusFilter && STATUSES.includes(statusFilter)
      ? await sql`SELECT * FROM messages WHERE status = ${statusFilter} ORDER BY created_at DESC`
      : await sql`SELECT * FROM messages ORDER BY created_at DESC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'PUT') {
    const id = req.query.id ? Number(req.query.id) : null;
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID da mensagem é obrigatório.' });
      return;
    }
    const body = parseBody(req);
    if (!STATUSES.includes(body.status)) {
      res.status(400).json({ ok: false, error: 'Status inválido.' });
      return;
    }
    const { rows } = await sql`UPDATE messages SET status = ${body.status} WHERE id = ${id} RETURNING *`;
    if (!rows.length) {
      res.status(404).json({ ok: false, error: 'Mensagem não encontrada.' });
      return;
    }
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
