const { del } = require('@vercel/blob');
const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { logActivity } = require('../../_lib/activity');

async function findUsage(url) {
  const usedIn = [];
  const [products, categories, seo, settings] = await Promise.all([
    sql`SELECT id, name FROM products WHERE main_image_url = ${url} OR ${url} = ANY(gallery_urls)`,
    sql`SELECT id, name FROM categories WHERE image_url = ${url}`,
    sql`SELECT id FROM seo_settings WHERE share_image_url = ${url}`,
    sql`SELECT id FROM site_settings WHERE logo_url = ${url} OR favicon_url = ${url}`,
  ]);
  products.rows.forEach((p) => usedIn.push({ type: 'produto', label: p.name, id: p.id }));
  categories.rows.forEach((c) => usedIn.push({ type: 'categoria', label: c.name, id: c.id }));
  if (seo.rows.length) usedIn.push({ type: 'seo', label: 'Imagem de compartilhamento (SEO)' });
  if (settings.rows.length) usedIn.push({ type: 'aparencia', label: 'Logo ou favicon do site' });
  return usedIn;
}

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const like = `%${search}%`;
    const { rows } = search
      ? await sql`SELECT * FROM media WHERE filename ILIKE ${like} OR folder ILIKE ${like} ORDER BY uploaded_at DESC LIMIT 200`
      : await sql`SELECT * FROM media ORDER BY uploaded_at DESC LIMIT 200`;

    if (req.query.withUsage === '1') {
      const items = await Promise.all(rows.map(async (item) => ({ ...item, usedIn: await findUsage(item.url) })));
      res.status(200).json({ ok: true, items });
      return;
    }
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'DELETE') {
    const id = req.query.id ? Number(req.query.id) : null;
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID do arquivo é obrigatório.' });
      return;
    }
    const { rows } = await sql`SELECT * FROM media WHERE id = ${id}`;
    if (!rows.length) {
      res.status(404).json({ ok: false, error: 'Arquivo não encontrado.' });
      return;
    }
    const item = rows[0];
    const usage = await findUsage(item.url);
    if (usage.length) {
      res.status(409).json({ ok: false, error: 'Este arquivo está em uso e não pode ser excluído.', usedIn: usage });
      return;
    }
    try {
      await del(item.url);
    } catch (e) {
      // segue removendo o registro mesmo se o blob já não existir mais
    }
    await sql`DELETE FROM media WHERE id = ${id}`;
    await logActivity({ action: 'deleted', entityType: 'media', entityId: id, description: `Arquivo "${item.filename}" excluído da mídia`, adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
