const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isOptionalString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT brand_name, instagram_url, whatsapp_number, contact_email, updated_at FROM site_settings WHERE id = 1`;
    res.status(200).json({ ok: true, settings: rows[0] || {} });
    return;
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    if (!isOptionalString(body.brandName, 100) || !isOptionalString(body.instagramUrl, 300) || !isOptionalString(body.whatsappNumber, 40) || !isOptionalString(body.contactEmail, 254)) {
      res.status(400).json({ ok: false, error: 'Valores inválidos.' });
      return;
    }
    const { rows } = await sql`
      UPDATE site_settings SET
        brand_name = ${str(body.brandName) || 'VERITÉ'},
        instagram_url = ${str(body.instagramUrl) || null},
        whatsapp_number = ${str(body.whatsappNumber) || null},
        contact_email = ${str(body.contactEmail) || null},
        updated_at = now()
      WHERE id = 1
      RETURNING brand_name, instagram_url, whatsapp_number, contact_email, updated_at
    `;
    await logActivity({ action: 'updated', entityType: 'settings', description: 'Configurações da VERITÉ atualizadas', adminEmail: session.email });
    res.status(200).json({ ok: true, settings: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
