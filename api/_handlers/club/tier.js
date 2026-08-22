const { requireClubSession } = require('../../_lib/clubAuth');
const { getTierForSpent, nextTierInfo } = require('../../_lib/clubTiers');

// Nível vale pra qualquer cliente logado (Iniciante ou Membro Verité) — o
// código de convite não é um portão pra progressão de nível.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const totalSpent = Number(customer.total_spent) || 0;
  const ordersCount = Number(customer.orders_count) || 0;
  const { tiers, current } = await getTierForSpent(totalSpent, ordersCount);
  const next = nextTierInfo(tiers, current, totalSpent, ordersCount);

  res.status(200).json({
    ok: true,
    totalSpent,
    ordersCount,
    tiers,
    currentTier: current,
    nextTier: next ? next.tier : null,
    remainingToNextTier: next ? next.remaining : 0,
    remainingOrdersToNextTier: next ? next.remainingOrders : 0,
  });
};
