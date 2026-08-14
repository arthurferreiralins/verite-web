const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { generateUniqueCode } = require('../../_lib/codeGen');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');
const { str } = require('../../_lib/validate');

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const like = `%${search}%`;
    const { rows } = await sql`
      SELECT cc.*, c.name AS customer_name, c.email AS customer_email
      FROM club_codes cc
      LEFT JOIN customers c ON c.id = cc.customer_id
      WHERE (${search} = '' OR cc.code ILIKE ${like} OR cc.label ILIKE ${like} OR c.name ILIKE ${like} OR c.email ILIKE ${like})
        AND (${status} = '' OR cc.status = ${status})
      ORDER BY cc.created_at DESC
    `;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 100);
    const label = str(body.label);
    const created = [];
    for (let i = 0; i < count; i++) {
      const code = await generateUniqueCode();
      const { rows } = await sql`INSERT INTO club_codes (code, label) VALUES (${code}, ${label}) RETURNING *`;
      created.push(rows[0]);
    }
    await logActivity({ action: 'created', entityType: 'club_code', description: `${count} código(s) de Clube gerado(s)${label ? ` (${label})` : ''}`, adminEmail: session.email });
    res.status(201).json({ ok: true, items: created });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do código é obrigatório.' });
      return;
    }
    const body = await readJsonBody(req);
    if (!['ativo', 'bloqueado'].includes(body.status)) {
      res.status(400).json({ ok: false, error: 'Status inválido.' });
      return;
    }
    const { rows: existing } = await sql`SELECT status FROM club_codes WHERE id = ${id}`;
    if (!existing.length) {
      res.status(404).json({ ok: false, error: 'Código não encontrado.' });
      return;
    }
    if (existing[0].status === 'utilizado') {
      res.status(409).json({ ok: false, error: 'Código já utilizado — não é possível alterar o status.' });
      return;
    }
    const { rows } = await sql`UPDATE club_codes SET status = ${body.status} WHERE id = ${id} RETURNING *`;
    await logActivity({ action: 'updated', entityType: 'club_code', entityId: id, description: `Código ${rows[0].code} marcado como ${body.status}`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
