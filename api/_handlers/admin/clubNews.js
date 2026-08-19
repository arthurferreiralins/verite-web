const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM club_news ORDER BY published_at DESC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const title = str(body.title);
    if (!isNonEmptyString(title, 160)) { res.status(400).json({ ok: false, error: 'Título é obrigatório.' }); return; }
    const { rows } = await sql`
      INSERT INTO club_news (title, description, image_url, published_at, active)
      VALUES (${title}, ${str(body.description)}, ${str(body.imageUrl) || null}, ${body.publishedAt ? new Date(body.publishedAt) : new Date()}, ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'club_news', entityId: rows[0].id, description: `Novidade "${title}" publicada`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID da novidade é obrigatório.' }); return; }
    const { rows: existingRows } = await sql`SELECT * FROM club_news WHERE id = ${id}`;
    if (!existingRows.length) { res.status(404).json({ ok: false, error: 'Novidade não encontrada.' }); return; }
    const existing = existingRows[0];
    const body = await readJsonBody(req);
    const title = body.title != null ? str(body.title) : existing.title;
    if (!isNonEmptyString(title, 160)) { res.status(400).json({ ok: false, error: 'Título é obrigatório.' }); return; }
    const { rows } = await sql`
      UPDATE club_news SET
        title = ${title},
        description = ${body.description != null ? str(body.description) : existing.description},
        image_url = ${body.imageUrl !== undefined ? (str(body.imageUrl) || null) : existing.image_url},
        published_at = ${body.publishedAt ? new Date(body.publishedAt) : existing.published_at},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active}
      WHERE id = ${id} RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'club_news', entityId: id, description: `Novidade "${rows[0].title}" atualizada`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID da novidade é obrigatório.' }); return; }
    const { rows } = await sql`DELETE FROM club_news WHERE id = ${id} RETURNING title`;
    if (rows.length) await logActivity({ action: 'deleted', entityType: 'club_news', entityId: id, description: `Novidade "${rows[0].title}" excluída`, adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
