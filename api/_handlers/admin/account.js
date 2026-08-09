const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isOptionalString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

// Autenticação é um único admin via env var (ADMIN_EMAIL/ADMIN_PASSWORD_HASH)
// — não existe tabela de usuários. "Minha conta" só guarda um apelido de
// exibição; trocar e-mail/senha exige atualizar as variáveis de ambiente na
// Vercel (fora do alcance desta rota, de propósito — nunca por API).
module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT admin_display_name FROM site_settings WHERE id = 1`;
    res.status(200).json({ ok: true, account: { email: session.email, displayName: (rows[0] && rows[0].admin_display_name) || '' } });
    return;
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    if (!isOptionalString(body.displayName, 100)) {
      res.status(400).json({ ok: false, error: 'Nome inválido.' });
      return;
    }
    await sql`UPDATE site_settings SET admin_display_name = ${str(body.displayName) || null}, updated_at = now() WHERE id = 1`;
    await logActivity({ action: 'updated', entityType: 'account', description: 'Nome de exibição da conta atualizado', adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
