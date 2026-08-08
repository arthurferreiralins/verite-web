const { sql } = require('../_lib/db');
const { requireAdminSession } = require('../_lib/auth');
const { isNonEmptyString, str } = require('../_lib/validate');

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

  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM faq_items ORDER BY sort_order ASC, id ASC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const question = str(body.question);
    const answer = str(body.answer);
    if (!isNonEmptyString(question, 300) || !isNonEmptyString(answer, 4000)) {
      res.status(400).json({ ok: false, error: 'Pergunta e resposta são obrigatórias.' });
      return;
    }
    const { rows: maxRows } = await sql`SELECT COALESCE(max(sort_order), 0) + 1 AS n FROM faq_items`;
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : maxRows[0].n;
    const { rows } = await sql`
      INSERT INTO faq_items (question, answer, sort_order, active)
      VALUES (${question}, ${answer}, ${sortOrder}, ${body.active !== false})
      RETURNING *
    `;
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    const body = parseBody(req);

    if (!id && Array.isArray(body.reorder)) {
      for (const entry of body.reorder) {
        if (!entry || !Number.isFinite(Number(entry.id))) continue;
        await sql`UPDATE faq_items SET sort_order = ${Number(entry.sortOrder) || 0}, updated_at = now() WHERE id = ${Number(entry.id)}`;
      }
      const { rows } = await sql`SELECT * FROM faq_items ORDER BY sort_order ASC, id ASC`;
      res.status(200).json({ ok: true, items: rows });
      return;
    }

    if (!id) {
      res.status(400).json({ ok: false, error: 'ID da pergunta é obrigatório.' });
      return;
    }
    const { rows: existingRows } = await sql`SELECT * FROM faq_items WHERE id = ${id}`;
    if (!existingRows.length) {
      res.status(404).json({ ok: false, error: 'Pergunta não encontrada.' });
      return;
    }
    const existing = existingRows[0];
    const question = body.question != null ? str(body.question) : existing.question;
    const answer = body.answer != null ? str(body.answer) : existing.answer;
    if (!isNonEmptyString(question, 300) || !isNonEmptyString(answer, 4000)) {
      res.status(400).json({ ok: false, error: 'Pergunta e resposta são obrigatórias.' });
      return;
    }
    const { rows } = await sql`
      UPDATE faq_items SET
        question = ${question},
        answer = ${answer},
        sort_order = ${body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sort_order},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID da pergunta é obrigatório.' });
      return;
    }
    await sql`DELETE FROM faq_items WHERE id = ${id}`;
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
