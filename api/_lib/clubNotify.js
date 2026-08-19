const { sql } = require('./db');

/**
 * Notificação real do Clube, criada só quando algo real acontece (cupom
 * concedido, pontos ajustados, nível mudou, pedido mudou de status) — nunca
 * uma mensagem genérica sem gatilho. Best-effort: nunca deve quebrar a
 * operação principal que a disparou.
 */
async function notify(customerId, message) {
  try {
    await sql`INSERT INTO club_notifications (customer_id, message) VALUES (${customerId}, ${message})`;
  } catch (e) {
    // best-effort — mesma filosofia de api/_lib/activity.js
  }
}

module.exports = { notify };
