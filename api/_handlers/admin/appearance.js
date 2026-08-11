const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isOptionalString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT logo_url, favicon_url FROM site_settings WHERE id = 1`;
    res.status(200).json({ ok: true, appearance: rows[0] || {} });
    return;
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    if (!isOptionalString(body.logoUrl, 500) || !isOptionalString(body.faviconUrl, 500)) {
      res.status(400).json({ ok: false, error: 'Valores inválidos.' });
      return;
    }
    const { rows } = await sql`
      UPDATE site_settings SET
        logo_url = ${str(body.logoUrl) || null},
        favicon_url = ${str(body.faviconUrl) || null},
        updated_at = now()
      WHERE id = 1
      RETURNING logo_url, favicon_url
    `;
    await logActivity({ action: 'updated', entityType: 'appearance', description: 'Identidade visual (logo/favicon) atualizada', adminEmail: session.email });
    res.status(200).json({ ok: true, appearance: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
