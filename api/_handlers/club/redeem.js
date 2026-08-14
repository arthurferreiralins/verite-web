const { sql } = require('../../_lib/db');
const { normalizeCode } = require('../../_lib/codeGen');
const { readJsonBody } = require('../../_lib/readBody');
const { getClientIp, isCodeRateLimited, recordCodeAttempt } = require('../../_lib/rateLimit');

// Só valida o código (sem consumir/vincular a ninguém ainda) — usado pela
// tela de desbloqueio antes de mostrar o formulário de cadastro. A ativação
// de verdade (que marca o código como utilizado) acontece em register.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const ip = getClientIp(req);
  try {
    if (await isCodeRateLimited(ip)) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' });
      return;
    }
  } catch (e) {
    // segue sem bloquear se a tabela de rate limit não estiver acessível
  }

  const body = await readJsonBody(req);
  const code = normalizeCode(body.code);

  if (!code) {
    res.status(400).json({ ok: false, error: 'Informe o código do seu cartão.' });
    return;
  }

  const { rows } = await sql`SELECT status FROM club_codes WHERE code = ${code}`;

  try {
    await recordCodeAttempt(ip, rows.length > 0 && rows[0].status === 'ativo');
  } catch (e) {
    // best effort
  }

  if (!rows.length) {
    res.status(404).json({ ok: false, error: 'Código não encontrado. Confira e tente novamente.' });
    return;
  }
  const status = rows[0].status;
  if (status === 'bloqueado') {
    res.status(403).json({ ok: false, error: 'Este código está bloqueado.' });
    return;
  }
  if (status === 'utilizado') {
    res.status(409).json({ ok: false, error: 'Este código já foi utilizado. Se é seu, faça login.' });
    return;
  }

  res.status(200).json({ ok: true, valid: true });
};
