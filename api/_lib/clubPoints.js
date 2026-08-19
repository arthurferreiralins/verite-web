const { sql } = require('./db');

/**
 * Ledger de pontos — nunca um saldo mutável. Toda mudança é uma linha em
 * club_points_transactions; o saldo é sempre SUM(delta). Só o backend
 * escreve aqui (ajuste manual do admin, ou resgate de recompensa que já
 * checou saldo suficiente antes de gravar o delta negativo).
 */
async function getBalance(customerId) {
  const { rows } = await sql`
    SELECT COALESCE(SUM(delta), 0)::int AS balance FROM club_points_transactions WHERE customer_id = ${customerId}
  `;
  return rows[0].balance;
}

async function getHistory(customerId, limit) {
  const { rows } = await sql`
    SELECT id, delta, reason, created_at FROM club_points_transactions
    WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT ${limit || 50}
  `;
  return rows;
}

async function addTransaction(customerId, delta, reason, adminEmail) {
  const { rows } = await sql`
    INSERT INTO club_points_transactions (customer_id, delta, reason, admin_email)
    VALUES (${customerId}, ${delta}, ${reason}, ${adminEmail || null})
    RETURNING *
  `;
  return rows[0];
}

module.exports = { getBalance, getHistory, addTransaction };
