const { sql } = require('../../_lib/db');
const { requireAdminSession, createSessionCookie } = require('../../_lib/auth');
const { isOptionalString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

// Autenticação é um único admin via env var (ADMIN_EMAIL/ADMIN_PASSWORD_HASH)
// — não existe tabela de usuários. "Minha conta" só guarda um apelido de
// exibição; trocar e-mail/senha exige atualizar as variáveis de ambiente na
// Vercel (fora do alcance desta rota, de propósito — nunca por API).
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
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

  // Encerrar outras sessões: incrementar site_settings.session_version torna
  // inválido qualquer cookie assinado com a versão antiga (verificado em
  // requireAdminSession) — inclusive o desta própria requisição, por isso
  // reemitimos um cookie novo já com a versão atualizada pra quem pediu
  // continuar logado neste navegador.
  if (req.method === 'POST' && req.query.action === 'logout-others') {
    const { rows } = await sql`
      UPDATE site_settings SET session_version = session_version + 1, updated_at = now()
      WHERE id = 1
      RETURNING session_version
    `;
    const newVersion = rows[0] ? rows[0].session_version : 1;
    res.setHeader('Set-Cookie', createSessionCookie(req, session.email, newVersion));
    await logActivity({ action: 'updated', entityType: 'account', description: 'Sessões em outros dispositivos foram encerradas', adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
