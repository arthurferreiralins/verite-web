const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const { rows } = await sql`
    SELECT c.id, c.name, c.code, c.discount_label, c.description, c.valid_until, cc.status, cc.granted_at, cc.used_at
    FROM customer_coupons cc
    JOIN coupons c ON c.id = cc.coupon_id
    WHERE cc.customer_id = ${customer.id}
    ORDER BY cc.granted_at DESC
  `;
  res.status(200).json({ ok: true, items: rows });
};
