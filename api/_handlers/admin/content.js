const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT key, label, value, updated_at FROM content_blocks ORDER BY key ASC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
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
    if (updatedKeys.length) {
      await logActivity({ action: 'updated', entityType: 'content', description: `Conteúdo do site atualizado (${updatedKeys.length} campo${updatedKeys.length > 1 ? 's' : ''})`, adminEmail: session.email });
    }
    res.status(200).json({ ok: true, updated: updatedKeys });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
