const { requireClubSession, getSessionToken } = require('../../_lib/clubAuth');

/**
 * "Quem é você?" do Clube.
 *
 * Esta rota é chamada em TODA página do site (assets/js/favorites.js precisa
 * saber se guarda os favoritos na conta ou só no navegador). Antes ela
 * respondia 401 para quem não está logado — ou seja, para a esmagadora
 * maioria dos visitantes —, e cada um deles via um erro vermelho no console
 * do navegador numa navegação perfeitamente normal.
 *
 * Não estar logado não é um erro: agora, quando não há sessão utilizável, a
 * resposta é 200 com `customer: null`. Isso cobre tanto "nenhum cookie"
 * quanto "cookie ilegível ou expirado" — nos dois casos o estado real é o
 * mesmo, visitante deslogado. O 401 continua existindo para o caso em que o
 * cookie é VÁLIDO mas a sessão foi derrubada do outro lado: conta apagada ou
 * senha trocada (session_version), que requireClubSession detecta. Aí o
 * cliente precisa mesmo saber que caiu.
 *
 * Quem consome isto tem de olhar `customer`, nunca só o status HTTP:
 *   - assets/js/favorites.js  -> checkClub()
 *   - clube/assets/js/club.js -> sessão inicial
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  // visitante sem nenhum cookie de sessão: resposta normal, não erro
  if (!getSessionToken(req)) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({ ok: true, customer: null });
    return;
  }

  // a partir daqui existe um cookie: se ele não valer, 401 é a resposta certa
  const customer = await requireClubSession(req, res);
  if (!customer) return;
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ ok: true, customer });
};
