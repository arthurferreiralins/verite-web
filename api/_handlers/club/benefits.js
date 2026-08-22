const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');
const { getTierForSpent } = require('../../_lib/clubTiers');
const { readJsonBody } = require('../../_lib/readBody');
const { notify } = require('../../_lib/clubNotify');

// GET: cada benefício com status real (disponível/utilizado/bloqueado até
// nível X) calculado no backend a partir do nível do cliente — nunca um
// texto estático. POST {benefitId}: marca como utilizado, só se elegível.
//
// Elegibilidade é por RANK de nível (posição na progressão), não por
// min_spent isolado — dois níveis podem empatar em min_spent (ex: Start e
// Basic, que se diferenciam por min_orders) e comparar só o valor deixaria
// os dois elegíveis um pro outro por engano. O nível vale pra qualquer
// cliente logado, com ou sem código de convite ativado.
module.exports = async function handler(req, res) {
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const totalSpent = Number(customer.total_spent) || 0;
  const ordersCount = Number(customer.orders_count) || 0;
  const { tiers, current } = await getTierForSpent(totalSpent, ordersCount);
  const rank = {};
  tiers.forEach((t, i) => { rank[t.id] = i; });
  const currentRank = current ? rank[current.id] : -1;

  if (req.method === 'GET') {
    const { rows: benefits } = await sql`
      SELECT b.*, t.name AS tier_name, t.min_spent AS tier_min_spent
      FROM club_benefits b LEFT JOIN club_tiers t ON t.id = b.tier_id
      WHERE b.active = true ORDER BY COALESCE(t.min_spent,0) ASC, COALESCE(t.min_orders,0) ASC, b.sort_order ASC
    `;
    const { rows: redemptions } = await sql`SELECT benefit_id, redeemed_at FROM customer_benefit_redemptions WHERE customer_id = ${customer.id}`;
    const redeemedMap = {};
    redemptions.forEach((r) => { redeemedMap[r.benefit_id] = r.redeemed_at; });

    const items = benefits.map((b) => {
      const requiredRank = b.tier_id != null && rank[b.tier_id] != null ? rank[b.tier_id] : 0;
      const eligible = currentRank >= requiredRank;
      let status = 'bloqueado';
      if (eligible) status = redeemedMap[b.id] ? 'usado' : 'disponivel';
      return { ...b, status, redeemedAt: redeemedMap[b.id] || null };
    });
    res.status(200).json({ ok: true, items, currentTier: current });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const benefitId = Number(body.benefitId);
    if (!benefitId) {
      res.status(400).json({ ok: false, error: 'Benefício inválido.' });
      return;
    }
    const { rows } = await sql`
      SELECT b.*, t.name AS tier_name
      FROM club_benefits b LEFT JOIN club_tiers t ON t.id = b.tier_id
      WHERE b.id = ${benefitId} AND b.active = true
    `;
    if (!rows.length) {
      res.status(404).json({ ok: false, error: 'Benefício não encontrado.' });
      return;
    }
    const benefit = rows[0];
    const requiredRank = benefit.tier_id != null && rank[benefit.tier_id] != null ? rank[benefit.tier_id] : 0;
    if (currentRank < requiredRank) {
      res.status(403).json({ ok: false, error: `Disponível a partir do nível ${benefit.tier_name || ''}.` });
      return;
    }
    const { rows: inserted } = await sql`
      INSERT INTO customer_benefit_redemptions (customer_id, benefit_id) VALUES (${customer.id}, ${benefitId})
      ON CONFLICT (customer_id, benefit_id) DO NOTHING
      RETURNING *
    `;
    if (!inserted.length) {
      res.status(409).json({ ok: false, error: 'Este benefício já foi utilizado.' });
      return;
    }
    await notify(customer.id, `Você usou o benefício "${benefit.name}".`);
    res.status(201).json({ ok: true, item: inserted[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
