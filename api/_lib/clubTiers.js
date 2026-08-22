const { sql } = require('./db');

/**
 * Nível do Clube nunca é uma coluna gravável — é sempre calculado comparando
 * customers.total_spent/orders_count com os limiares configuráveis em
 * club_tiers. Um nível exige DUAS condições (min_spent E min_orders): é o
 * que permite um nível como "Basic" liberar já na 1ª compra, independente
 * do valor, sem empatar com o nível de entrada (que também é min_spent=0).
 * Sem pedido real ainda, todo mundo cai no nível de entrada, o que é honesto.
 */
async function getActiveTiers() {
  const { rows } = await sql`SELECT * FROM club_tiers WHERE active = true ORDER BY min_spent ASC, min_orders ASC, sort_order ASC`;
  return rows;
}

function tierUnlocked(tier, totalSpent, ordersCount) {
  return Number(totalSpent) >= Number(tier.min_spent) && Number(ordersCount) >= Number(tier.min_orders || 0);
}

async function getTierForSpent(totalSpent, ordersCount) {
  const tiers = await getActiveTiers();
  const spent = Number(totalSpent) || 0;
  const orders = Number(ordersCount) || 0;
  let current = tiers[0] || null;
  for (const tier of tiers) {
    if (tierUnlocked(tier, spent, orders)) current = tier;
  }
  return { tiers, current };
}

/** Próximo nível e quanto falta (em R$ e em nº de pedidos), ou null se já está no topo. */
function nextTierInfo(tiers, current, totalSpent, ordersCount) {
  if (!current) return null;
  const spent = Number(totalSpent) || 0;
  const orders = Number(ordersCount) || 0;
  const idx = tiers.findIndex((t) => t.id === current.id);
  const next = idx > -1 ? tiers[idx + 1] : null;
  if (!next) return null;
  return {
    tier: next,
    remaining: Math.max(0, Number(next.min_spent) - spent),
    remainingOrders: Math.max(0, Number(next.min_orders || 0) - orders),
  };
}

module.exports = { getActiveTiers, getTierForSpent, nextTierInfo, tierUnlocked };
