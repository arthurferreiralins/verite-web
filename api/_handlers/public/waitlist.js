const { sql } = require('../../_lib/db');
const { getClientIp, isSubmissionRateLimited, recordSubmissionAttempt } = require('../../_lib/rateLimit');
const { isValidEmail, isNonEmptyString, str } = require('../../_lib/validate');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const body = parseBody(req);

  // Honeypot: real users never fill a hidden field named "website".
  if (str(body.website)) {
    res.status(200).json({ ok: true });
    return;
  }

  const name = str(body.name);
  const email = str(body.email).toLowerCase();

  if (!isNonEmptyString(name, 200) || !isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'Preencha nome e e-mail corretamente.' });
    return;
  }

  const ip = getClientIp(req);
  try {
    if (await isSubmissionRateLimited(ip, 'waitlist')) {
      res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
      return;
    }
    await recordSubmissionAttempt(ip, 'waitlist');
  } catch (e) {
    // best effort rate limiting; never block a legitimate signup because of it
  }

  // Perfume de interesse (opcional). Vem das fichas "em breve" de cada
  // perfume (perfume-*.html). Só aceita um nome curto e sem quebras de
  // linha — é gravado e depois exibido/exportado no painel.
  const perfume = str(body.perfume).replace(/\s+/g, ' ').slice(0, 80);

  try {
    if (perfume) {
      try {
        // Com a coluna `perfume` (db/schema.sql). Quem já está na lista e
        // pede aviso de OUTRO perfume ganha o nome acrescentado, em vez de
        // ser ignorado pelo ON CONFLICT — senão o segundo interesse se perde.
        await sql`
          INSERT INTO leads (name, email, perfume) VALUES (${name}, ${email}, ${perfume})
          ON CONFLICT (email) DO UPDATE SET perfume = CASE
            WHEN leads.perfume IS NULL OR leads.perfume = '' THEN EXCLUDED.perfume
            WHEN position(EXCLUDED.perfume in leads.perfume) > 0 THEN leads.perfume
            ELSE leads.perfume || ', ' || EXCLUDED.perfume
          END`;
      } catch (e) {
        // 42703 = coluna inexistente: o schema novo ainda não foi aplicado no
        // banco. O cadastro NÃO pode falhar por isso — cai no caminho antigo,
        // que só perde o nome do perfume, nunca o e-mail da pessoa.
        if (!e || e.code !== '42703') throw e;
        await sql`INSERT INTO leads (name, email) VALUES (${name}, ${email}) ON CONFLICT (email) DO NOTHING`;
      }
    } else {
      await sql`INSERT INTO leads (name, email) VALUES (${name}, ${email}) ON CONFLICT (email) DO NOTHING`;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Não foi possível processar seu cadastro agora.' });
  }
};
