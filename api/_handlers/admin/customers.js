const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');

// Estrutura pronta (seção 13 do pedido) — nenhuma linha é inserida por esta
// rota; a tabela só é populada quando um pedido real gerar/atualizar um
// cliente (fora de escopo até existir checkout).
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const like = `%${search}%`;
  const { rows } = search
    ? await sql`SELECT * FROM customers WHERE name ILIKE ${like} OR email ILIKE ${like} ORDER BY created_at DESC`
    : await sql`SELECT * FROM customers ORDER BY created_at DESC`;
  res.status(200).json({ ok: true, items: rows });
};
