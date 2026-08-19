const { sql } = require('./db');

/**
 * Nível do Clube nunca é uma coluna gravável — é sempre calculado comparando
 * customers.total_spent (real, atualizado quando um pedido existir) com os
 * limiares configuráveis em club_tiers. Sem pedido real ainda, todo mundo
 * cai no nível de entrada (min_spent = 0), o que é honesto.
 */
async function getActiveTiers() {
  const { rows } = await sql`SELECT * FROM club_tiers WHERE active = true ORDER BY min_spent ASC`;
  return rows;
}

async function getTierForSpent(totalSpent) {
  const tiers = await getActiveTiers();
  const spent = Number(totalSpent) || 0;
  let current = tiers[0] || null;
  for (const tier of tiers) {
    if (spent >= Number(tier.min_spent)) current = tier;
  }
  return { tiers, current };
}

/** Próximo nível e quanto falta em R$, ou null se já está no topo. */
function nextTierInfo(tiers, current, totalSpent) {
  if (!current) return null;
  const spent = Number(totalSpent) || 0;
  const above = tiers.filter((t) => Number(t.min_spent) > Number(current.min_spent));
  if (!above.length) return null;
  const next = above[0];
  return { tier: next, remaining: Math.max(0, Number(next.min_spent) - spent) };
}

module.exports = { getActiveTiers, getTierForSpent, nextTierInfo };
