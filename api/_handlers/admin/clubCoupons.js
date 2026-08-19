const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');

// CRUD sobre a tabela `coupons` já existente (era só seed manual até aqui —
// o cupom de boas-vindas VERITE10 continua funcionando normalmente).
module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  const id = req.query.id ? Number(req.query.id) : null;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT c.*, (SELECT count(*)::int FROM customer_coupons cc WHERE cc.coupon_id = c.id) AS holders
      FROM coupons c ORDER BY c.created_at DESC
    `;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = str(body.name);
    const code = str(body.code).toUpperCase();
    const discountLabel = str(body.discountLabel);
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    if (!isNonEmptyString(code, 40)) { res.status(400).json({ ok: false, error: 'Código é obrigatório.' }); return; }
    if (!isNonEmptyString(discountLabel, 60)) { res.status(400).json({ ok: false, error: 'Informe o texto do desconto (ex. "10% OFF").' }); return; }
    const { rows: dup } = await sql`SELECT id FROM coupons WHERE code = ${code}`;
    if (dup.length) { res.status(409).json({ ok: false, error: 'Já existe um cupom com este código.' }); return; }
    const { rows } = await sql`
      INSERT INTO coupons (name, code, discount_label, description, valid_until, auto_grant, active)
      VALUES (${name}, ${code}, ${discountLabel}, ${str(body.description)}, ${body.validUntil || null}, ${Boolean(body.autoGrant)}, ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'coupon', entityId: rows[0].id, description: `Cupom "${code}" criado`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do cupom é obrigatório.' }); return; }
    const { rows: existingRows } = await sql`SELECT * FROM coupons WHERE id = ${id}`;
    if (!existingRows.length) { res.status(404).json({ ok: false, error: 'Cupom não encontrado.' }); return; }
    const existing = existingRows[0];
    const body = await readJsonBody(req);
    const name = body.name != null ? str(body.name) : existing.name;
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    let code = existing.code;
    if (body.code != null && str(body.code)) {
      const candidate = str(body.code).toUpperCase();
      if (candidate !== existing.code) {
        const { rows: dup } = await sql`SELECT id FROM coupons WHERE code = ${candidate} AND id <> ${id}`;
        if (dup.length) { res.status(409).json({ ok: false, error: 'Já existe um cupom com este código.' }); return; }
        code = candidate;
      }
    }
    const { rows } = await sql`
      UPDATE coupons SET
        name = ${name}, code = ${code},
        discount_label = ${body.discountLabel != null ? str(body.discountLabel) : existing.discount_label},
        description = ${body.description != null ? str(body.description) : existing.description},
        valid_until = ${body.validUntil !== undefined ? (body.validUntil || null) : existing.valid_until},
        auto_grant = ${body.autoGrant !== undefined ? Boolean(body.autoGrant) : existing.auto_grant},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active}
      WHERE id = ${id} RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'coupon', entityId: id, description: `Cupom "${rows[0].code}" atualizado`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do cupom é obrigatório.' }); return; }
    const { rows } = await sql`DELETE FROM coupons WHERE id = ${id} RETURNING code`;
    if (rows.length) await logActivity({ action: 'deleted', entityType: 'coupon', entityId: id, description: `Cupom "${rows[0].code}" excluído`, adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
