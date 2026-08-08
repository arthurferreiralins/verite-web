const { sql } = require('../_lib/db');
const { requireAdminSession } = require('../_lib/auth');

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
    const { rows } = await sql`SELECT key, label, value, updated_at FROM content_blocks ORDER BY key ASC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'PUT') {
    const body = parseBody(req);
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (!updates.length) {
      res.status(400).json({ ok: false, error: 'Nenhuma alteração enviada.' });
      return;
    }
    const updatedKeys = [];
    for (const item of updates) {
      if (!item || typeof item.key !== 'string' || typeof item.value !== 'string') continue;
      if (item.value.length > 20000) continue;
      const { rows } = await sql`
        UPDATE content_blocks SET value = ${item.value}, updated_at = now()
        WHERE key = ${item.key}
        RETURNING key
      `;
      if (rows.length) updatedKeys.push(item.key);
    }
    res.status(200).json({ ok: true, updated: updatedKeys });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
