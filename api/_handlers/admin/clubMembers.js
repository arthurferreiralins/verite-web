const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { getTierForSpent } = require('../../_lib/clubTiers');
const { getBalance, getHistory } = require('../../_lib/clubPoints');

// Gestão de membros — só leitura de dados reais (nome, número, e-mail,
// nível/pontos calculados, compras, data de entrada, status). Ajuste de
// pontos e concessão de presentes ficam em rotas próprias
// (clubPointsAdjust.js / clubGifts.js), nunca aqui, pra manter cada ação
// administrativa sensível isolada e explícita.
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const id = req.query.id ? Number(req.query.id) : null;

  if (id) {
    const { rows } = await sql`SELECT * FROM customers WHERE id = ${id} AND club_member = true`;
    if (!rows.length) {
      res.status(404).json({ ok: false, error: 'Membro não encontrado.' });
      return;
    }
    const customer = rows[0];
    delete customer.password_hash;
    const { current } = await getTierForSpent(Number(customer.total_spent) || 0);
    const [balance, history, coupons, orders, benefitRedemptions, giftRedemptions] = await Promise.all([
      getBalance(id),
      getHistory(id, 100),
      sql`SELECT cc.status, c.name, c.code FROM customer_coupons cc JOIN coupons c ON c.id = cc.coupon_id WHERE cc.customer_id = ${id} ORDER BY cc.granted_at DESC`,
      sql`SELECT order_number, total, status, created_at FROM orders WHERE customer_id = ${id} ORDER BY created_at DESC`,
      sql`SELECT b.name, r.redeemed_at FROM customer_benefit_redemptions r JOIN club_benefits b ON b.id = r.benefit_id WHERE r.customer_id = ${id} ORDER BY r.redeemed_at DESC`,
      sql`SELECT g.name, r.redeemed_at FROM customer_gift_redemptions r JOIN club_gifts g ON g.id = r.gift_id WHERE r.customer_id = ${id} ORDER BY r.redeemed_at DESC`,
    ]);
    res.status(200).json({
      ok: true,
      member: customer,
      tier: current,
      points: { balance, history },
      coupons: coupons.rows,
      orders: orders.rows,
      benefitRedemptions: benefitRedemptions.rows,
      giftRedemptions: giftRedemptions.rows,
    });
    return;
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const like = `%${search}%`;
  const { rows } = await sql`
    SELECT * FROM customers
    WHERE club_member = true AND (${search} = '' OR name ILIKE ${like} OR email ILIKE ${like} OR member_number ILIKE ${like})
    ORDER BY club_joined_at DESC
  `;
  const tiers = await sql`SELECT * FROM club_tiers WHERE active = true ORDER BY min_spent ASC`;

  const items = await Promise.all(rows.map(async (c) => {
    delete c.password_hash;
    const spent = Number(c.total_spent) || 0;
    let tier = tiers.rows[0] || null;
    tiers.rows.forEach((t) => { if (spent >= Number(t.min_spent)) tier = t; });
    const balance = await getBalance(c.id);
    return { ...c, tierName: tier ? tier.name : null, pointsBalance: balance };
  }));

  res.status(200).json({ ok: true, items });
};
