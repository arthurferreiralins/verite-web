const { sql } = require('../../_lib/db');
const { requireClubSession, hashPassword, verifyPassword, createSessionCookie } = require('../../_lib/clubAuth');
const { isNonEmptyString, str } = require('../../_lib/validate');
const { readJsonBody } = require('../../_lib/readBody');

// PUT atualiza nome/telefone sempre; troca de senha só acontece se
// currentPassword+newPassword vierem preenchidos, e bump de session_version
// derruba qualquer outra sessão aberta com a senha antiga.
module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  const body = await readJsonBody(req);
  const name = body.name != null ? str(body.name) : customer.name;
  const phone = body.phone != null ? str(body.phone) : customer.phone;
  const address = body.address != null ? str(body.address) : customer.address;
  let birthday = customer.birthday;
  if (body.birthday !== undefined) {
    if (body.birthday === '' || body.birthday === null) {
      birthday = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(str(body.birthday))) {
      birthday = str(body.birthday);
    } else {
      res.status(400).json({ ok: false, error: 'Data de aniversário inválida.' });
      return;
    }
  }

  if (!isNonEmptyString(name, 120)) {
    res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
    return;
  }

  const wantsPasswordChange = isNonEmptyString(body.newPassword);
  if (wantsPasswordChange) {
    const { rows } = await sql`SELECT password_hash FROM customers WHERE id = ${customer.id}`;
    if (!verifyPassword(str(body.currentPassword), rows[0].password_hash)) {
      res.status(400).json({ ok: false, error: 'Senha atual incorreta.' });
      return;
    }
    if (body.newPassword.length < 6) {
      res.status(400).json({ ok: false, error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
      return;
    }
    const newHash = hashPassword(body.newPassword);
    const { rows: updated } = await sql`
      UPDATE customers SET name = ${name}, phone = ${phone || null}, birthday = ${birthday}, address = ${address || null}, password_hash = ${newHash},
        session_version = session_version + 1
      WHERE id = ${customer.id}
      RETURNING *
    `;
    res.setHeader('Set-Cookie', createSessionCookie(req, customer.id, updated[0].session_version));
    delete updated[0].password_hash;
    res.status(200).json({ ok: true, customer: updated[0] });
    return;
  }

  const { rows: updated } = await sql`
    UPDATE customers SET name = ${name}, phone = ${phone || null}, birthday = ${birthday}, address = ${address || null}
    WHERE id = ${customer.id}
    RETURNING *
  `;
  delete updated[0].password_hash;
  res.status(200).json({ ok: true, customer: updated[0] });
};
