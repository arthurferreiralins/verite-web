const { requireAdminSession } = require('../../_lib/auth');
const { readJsonBody } = require('../../_lib/readBody');
const { isNonEmptyString } = require('../../_lib/validate');
const { addTransaction, getBalance } = require('../../_lib/clubPoints');
const { notify } = require('../../_lib/clubNotify');
const { logActivity } = require('../../_lib/activity');
const { sql } = require('../../_lib/db');

// Único caminho pra alterar pontos de um cliente — sempre manual, sempre com
// motivo, sempre logado. Não existe rota nenhuma onde o próprio cliente
// consiga chamar isto (é /api/admin/*, atrás de requireAdminSession).
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const body = await readJsonBody(req);
  const customerId = Number(body.customerId);
  const delta = Number(body.delta);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!customerId) {
    res.status(400).json({ ok: false, error: 'Cliente inválido.' });
    return;
  }
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    res.status(400).json({ ok: false, error: 'Informe uma quantidade de pontos válida (positiva ou negativa).' });
    return;
  }
  if (!isNonEmptyString(reason, 200)) {
    res.status(400).json({ ok: false, error: 'Informe o motivo do ajuste.' });
    return;
  }

  const { rows } = await sql`SELECT id, name FROM customers WHERE id = ${customerId} AND club_member = true`;
  if (!rows.length) {
    res.status(404).json({ ok: false, error: 'Membro não encontrado.' });
    return;
  }

  await addTransaction(customerId, delta, reason, session.email);
  const balance = await getBalance(customerId);
  await notify(customerId, delta > 0 ? `Você recebeu ${delta} pontos: ${reason}.` : `${Math.abs(delta)} pontos foram debitados: ${reason}.`);
  await logActivity({ action: delta > 0 ? 'points_added' : 'points_removed', entityType: 'customer', entityId: customerId, description: `${delta > 0 ? '+' : ''}${delta} pontos para ${rows[0].name} — ${reason}`, adminEmail: session.email });

  res.status(201).json({ ok: true, balance });
};
