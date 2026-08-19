const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');
const { isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');
const { logActivity } = require('../../_lib/activity');
const { notify } = require('../../_lib/clubNotify');

const TRIGGER_TYPES = ['aniversario_cliente', 'aniversario_membro', 'manual'];
const REWARD_TYPES = ['cupom', 'pontos', 'frete', 'presente'];

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  const id = req.query.id ? Number(req.query.id) : null;

  // Concede um presente "manual" a um cliente específico — a única forma de
  // um presente do tipo manual virar "disponível" pra alguém.
  if (req.method === 'POST' && req.query.action === 'grant') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do presente é obrigatório.' }); return; }
    const body = await readJsonBody(req);
    const customerId = Number(body.customerId);
    if (!customerId) { res.status(400).json({ ok: false, error: 'Cliente inválido.' }); return; }
    const { rows: giftRows } = await sql`SELECT * FROM club_gifts WHERE id = ${id}`;
    if (!giftRows.length) { res.status(404).json({ ok: false, error: 'Presente não encontrado.' }); return; }
    const { rows: customerRows } = await sql`SELECT id, name FROM customers WHERE id = ${customerId} AND club_member = true`;
    if (!customerRows.length) { res.status(404).json({ ok: false, error: 'Membro não encontrado.' }); return; }
    await sql`
      INSERT INTO customer_gift_grants (customer_id, gift_id, admin_email) VALUES (${customerId}, ${id}, ${session.email})
      ON CONFLICT (customer_id, gift_id) DO NOTHING
    `;
    await notify(customerId, `Você recebeu um presente especial: "${giftRows[0].name}".`);
    await logActivity({ action: 'gift_granted', entityType: 'customer', entityId: customerId, description: `Presente "${giftRows[0].name}" concedido a ${customerRows[0].name}`, adminEmail: session.email });
    res.status(201).json({ ok: true });
    return;
  }

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM club_gifts ORDER BY id DESC`;
    res.status(200).json({ ok: true, items: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = str(body.name);
    const triggerType = TRIGGER_TYPES.includes(body.triggerType) ? body.triggerType : null;
    const rewardType = REWARD_TYPES.includes(body.rewardType) ? body.rewardType : null;
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    if (!triggerType) { res.status(400).json({ ok: false, error: 'Gatilho inválido.' }); return; }
    if (!rewardType) { res.status(400).json({ ok: false, error: 'Tipo de recompensa inválido.' }); return; }
    let triggerConfig = {};
    if (body.triggerConfig && typeof body.triggerConfig === 'object') triggerConfig = body.triggerConfig;
    const { rows } = await sql`
      INSERT INTO club_gifts (name, trigger_type, trigger_config, reward_type, reward_value, description, active)
      VALUES (${name}, ${triggerType}, ${JSON.stringify(triggerConfig)}, ${rewardType}, ${str(body.rewardValue)}, ${str(body.description)}, ${body.active !== false})
      RETURNING *
    `;
    await logActivity({ action: 'created', entityType: 'club_gift', entityId: rows[0].id, description: `Presente "${name}" criado`, adminEmail: session.email });
    res.status(201).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do presente é obrigatório.' }); return; }
    const { rows: existingRows } = await sql`SELECT * FROM club_gifts WHERE id = ${id}`;
    if (!existingRows.length) { res.status(404).json({ ok: false, error: 'Presente não encontrado.' }); return; }
    const existing = existingRows[0];
    const body = await readJsonBody(req);
    const name = body.name != null ? str(body.name) : existing.name;
    if (!isNonEmptyString(name, 120)) { res.status(400).json({ ok: false, error: 'Nome é obrigatório.' }); return; }
    const triggerType = body.triggerType !== undefined ? (TRIGGER_TYPES.includes(body.triggerType) ? body.triggerType : null) : existing.trigger_type;
    if (!triggerType) { res.status(400).json({ ok: false, error: 'Gatilho inválido.' }); return; }
    const rewardType = body.rewardType !== undefined ? (REWARD_TYPES.includes(body.rewardType) ? body.rewardType : null) : existing.reward_type;
    if (!rewardType) { res.status(400).json({ ok: false, error: 'Tipo de recompensa inválido.' }); return; }
    const triggerConfig = body.triggerConfig && typeof body.triggerConfig === 'object' ? body.triggerConfig : existing.trigger_config;
    const { rows } = await sql`
      UPDATE club_gifts SET
        name = ${name}, trigger_type = ${triggerType}, trigger_config = ${JSON.stringify(triggerConfig)},
        reward_type = ${rewardType}, reward_value = ${body.rewardValue != null ? str(body.rewardValue) : existing.reward_value},
        description = ${body.description != null ? str(body.description) : existing.description},
        active = ${body.active !== undefined ? Boolean(body.active) : existing.active}
      WHERE id = ${id} RETURNING *
    `;
    await logActivity({ action: 'updated', entityType: 'club_gift', entityId: id, description: `Presente "${rows[0].name}" atualizado`, adminEmail: session.email });
    res.status(200).json({ ok: true, item: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    if (!id) { res.status(400).json({ ok: false, error: 'ID do presente é obrigatório.' }); return; }
    const { rows } = await sql`DELETE FROM club_gifts WHERE id = ${id} RETURNING name`;
    if (rows.length) await logActivity({ action: 'deleted', entityType: 'club_gift', entityId: id, description: `Presente "${rows[0].name}" excluído`, adminEmail: session.email });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
