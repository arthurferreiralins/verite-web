const { requireClubSession } = require('../../_lib/clubAuth');
const { getTierForSpent, nextTierInfo } = require('../../_lib/clubTiers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const totalSpent = Number(customer.total_spent) || 0;
  const { tiers, current } = await getTierForSpent(totalSpent);
  const next = nextTierInfo(tiers, current, totalSpent);

  res.status(200).json({
    ok: true,
    totalSpent,
    tiers,
    currentTier: current,
    nextTier: next ? next.tier : null,
    remainingToNextTier: next ? next.remaining : 0,
  });
};
