const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isOptionalString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT site_title, meta_description, share_image_url, updated_at FROM seo_settings WHERE id = 1`;
    res.status(200).json({ ok: true, seo: rows[0] || {} });
    return;
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    if (!isOptionalString(body.siteTitle, 200) || !isOptionalString(body.metaDescription, 400) || !isOptionalString(body.shareImageUrl, 500)) {
      res.status(400).json({ ok: false, error: 'Valores inválidos.' });
      return;
    }
    const { rows } = await sql`
      UPDATE seo_settings SET
        site_title = ${str(body.siteTitle) || null},
        meta_description = ${str(body.metaDescription) || null},
        share_image_url = ${str(body.shareImageUrl) || null},
        updated_at = now()
      WHERE id = 1
      RETURNING site_title, meta_description, share_image_url, updated_at
    `;
    res.status(200).json({ ok: true, seo: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
