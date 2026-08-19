const { sql } = require('../../_lib/db');
const { requireClubSession } = require('../../_lib/clubAuth');
const { readJsonBody } = require('../../_lib/readBody');
const { addTransaction } = require('../../_lib/clubPoints');
const { notify } = require('../../_lib/clubNotify');

/**
 * Presentes do Clube — elegibilidade sempre calculada no backend a partir
 * de regras reais (data de aniversário informada pelo cliente, data real
 * de entrada no Clube) ou de uma concessão manual do admin — nunca um
 * presente aparece "disponível" sem uma regra/concessão de verdade por trás.
 */

function daysBetween(a, b) { return Math.round((a - b) / 86400000); }

function isWithinBirthdayWindow(birthday, daysBefore, daysAfter) {
  if (!birthday) return false;
  const bday = new Date(birthday);
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best = Infinity;
  [-1, 0, 1].forEach((yOff) => {
    const candidate = new Date(todayMid.getFullYear() + yOff, bday.getUTCMonth(), bday.getUTCDate());
    const d = daysBetween(candidate, todayMid);
    if (Math.abs(d) < Math.abs(best)) best = d;
  });
  return best >= -daysAfter && best <= daysBefore;
}

function membershipAnniversary(joinedAt, daysWindow) {
  if (!joinedAt) return { years: 0, withinWindow: false };
  const joined = new Date(joinedAt);
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let years = todayMid.getFullYear() - joined.getFullYear();
  const anniversaryThisYear = new Date(todayMid.getFullYear(), joined.getUTCMonth(), joined.getUTCDate());
  if (todayMid < anniversaryThisYear) years -= 1;
  let best = Infinity;
  [-1, 0, 1].forEach((yOff) => {
    const candidate = new Date(todayMid.getFullYear() + yOff, joined.getUTCMonth(), joined.getUTCDate());
    const d = daysBetween(candidate, todayMid);
    if (Math.abs(d) < Math.abs(best)) best = d;
  });
  return { years, withinWindow: Math.abs(best) <= daysWindow };
}

async function grantReward(customer, gift) {
  if (gift.reward_type === 'pontos') {
    const points = Number(gift.reward_value) || 0;
    if (points > 0) await addTransaction(customer.id, points, `Presente: ${gift.name}`, null);
  } else if (gift.reward_type === 'cupom') {
    const { rows: couponRows } = await sql`SELECT id FROM coupons WHERE code = ${gift.reward_value} AND active = true`;
    if (couponRows.length) {
      await sql`
        INSERT INTO customer_coupons (customer_id, coupon_id) VALUES (${customer.id}, ${couponRows[0].id})
        ON CONFLICT (customer_id, coupon_id) DO NOTHING
      `;
    }
  }
  // 'frete' e 'presente' são benefícios aplicados manualmente pela equipe no fechamento do pedido — sem automação de checkout ainda.
}

module.exports = async function handler(req, res) {
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const { rows: gifts } = await sql`SELECT * FROM club_gifts WHERE active = true ORDER BY id ASC`;
  const { rows: redemptions } = await sql`SELECT gift_id, period_key FROM customer_gift_redemptions WHERE customer_id = ${customer.id}`;
  const { rows: grants } = await sql`SELECT gift_id FROM customer_gift_grants WHERE customer_id = ${customer.id}`;
  const grantedIds = new Set(grants.map((g) => g.gift_id));
  const redeemedKeys = new Set(redemptions.map((r) => r.gift_id + ':' + r.period_key));

  function evaluate(gift) {
    const cfg = gift.trigger_config || {};
    if (gift.trigger_type === 'aniversario_cliente') {
      const eligible = isWithinBirthdayWindow(customer.birthday, cfg.daysBefore != null ? cfg.daysBefore : 3, cfg.daysAfter != null ? cfg.daysAfter : 3);
      const periodKey = String(new Date().getFullYear());
      return { eligible, periodKey, needsBirthday: !customer.birthday };
    }
    if (gift.trigger_type === 'aniversario_membro') {
      const info = membershipAnniversary(customer.club_joined_at, cfg.daysWindow != null ? cfg.daysWindow : 7);
      const minYears = cfg.years != null ? cfg.years : 1;
      const eligible = info.years >= minYears && info.withinWindow;
      return { eligible, periodKey: String(info.years), years: info.years };
    }
    // manual
    return { eligible: grantedIds.has(gift.id), periodKey: 'manual' };
  }

  if (req.method === 'GET') {
    const items = gifts.map((g) => {
      const evalResult = evaluate(g);
      const key = g.id + ':' + evalResult.periodKey;
      let status = 'bloqueado';
      if (redeemedKeys.has(key)) status = 'resgatado';
      else if (evalResult.eligible) status = 'disponivel';
      return {
        id: g.id, name: g.name, description: g.description, trigger_type: g.trigger_type,
        reward_type: g.reward_type, status, needsBirthday: evalResult.needsBirthday || false,
      };
    });
    res.status(200).json({ ok: true, items });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const giftId = Number(body.giftId);
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift) {
      res.status(404).json({ ok: false, error: 'Presente não encontrado.' });
      return;
    }
    const evalResult = evaluate(gift);
    if (!evalResult.eligible) {
      res.status(403).json({ ok: false, error: 'Este presente ainda não está disponível para você.' });
      return;
    }
    const { rows: inserted } = await sql`
      INSERT INTO customer_gift_redemptions (customer_id, gift_id, period_key)
      VALUES (${customer.id}, ${giftId}, ${evalResult.periodKey})
      ON CONFLICT (customer_id, gift_id, period_key) DO NOTHING
      RETURNING *
    `;
    if (!inserted.length) {
      res.status(409).json({ ok: false, error: 'Este presente já foi resgatado.' });
      return;
    }
    await grantReward(customer, gift);
    await notify(customer.id, `Você resgatou o presente "${gift.name}".`);
    res.status(201).json({ ok: true, item: inserted[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
