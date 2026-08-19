const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');
const { getBalance, getHistory } = require('../../_lib/clubPoints');
const { readJsonBody } = require('../../_lib/readBody');
const { notify } = require('../../_lib/clubNotify');

// GET: saldo + histórico real (nunca inventado) + regras de como ganhar +
// catálogo de recompensas. POST {rewardId}: resgata — o saldo é conferido e
// debitado numa única query atômica (CTE + INSERT...SELECT...WHERE), então
// duas requisições simultâneas nunca conseguem gastar mais do que existe.
module.exports = async function handler(req, res) {
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  // Pontos são um privilégio de Membro Verité — Iniciante nunca acumula nem
  // resgata pontos (validado aqui, não só escondido no frontend).
  if (!customer.club_member) {
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, balance: 0, history: [], rules: [], rewards: [] });
      return;
    }
    res.status(403).json({ ok: false, error: 'Disponível apenas para Membro Verité. Ative um código Verité para desbloquear.' });
    return;
  }

  if (req.method === 'GET') {
    const [balance, history, rulesRows, rewardsRows] = await Promise.all([
      getBalance(customer.id),
      getHistory(customer.id, 50),
      sql`SELECT * FROM club_points_rules WHERE active = true ORDER BY sort_order ASC, id ASC`,
      sql`SELECT * FROM club_rewards WHERE active = true ORDER BY points_cost ASC`,
    ]);
    res.status(200).json({
      ok: true,
      balance,
      history,
      rules: rulesRows.rows,
      rewards: rewardsRows.rows.map((r) => ({ ...r, affordable: balance >= r.points_cost })),
    });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const rewardId = Number(body.rewardId);
    if (!rewardId) {
      res.status(400).json({ ok: false, error: 'Recompensa inválida.' });
      return;
    }
    const { rows: rewardRows } = await sql`SELECT * FROM club_rewards WHERE id = ${rewardId} AND active = true`;
    if (!rewardRows.length) {
      res.status(404).json({ ok: false, error: 'Recompensa não encontrada.' });
      return;
    }
    const reward = rewardRows[0];

    const { rows: txRows } = await sql`
      WITH balance AS (
        SELECT COALESCE(SUM(delta), 0)::int AS bal FROM club_points_transactions WHERE customer_id = ${customer.id}
      )
      INSERT INTO club_points_transactions (customer_id, delta, reason)
      SELECT ${customer.id}, ${-reward.points_cost}, ${'Resgate: ' + reward.name} FROM balance WHERE bal >= ${reward.points_cost}
      RETURNING *
    `;
    if (!txRows.length) {
      res.status(400).json({ ok: false, error: 'Pontos insuficientes para essa recompensa.' });
      return;
    }
    await sql`
      INSERT INTO customer_reward_redemptions (customer_id, reward_id, points_tx_id)
      VALUES (${customer.id}, ${reward.id}, ${txRows[0].id})
    `;
    await notify(customer.id, `Você trocou ${reward.points_cost} pontos por "${reward.name}".`);
    const newBalance = await getBalance(customer.id);
    res.status(201).json({ ok: true, balance: newBalance, reward });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
