/**
 * Porteiro do dashboard administrativo.
 *
 * Antes, painel/index.html era um arquivo estatico unico que trazia a tela de
 * login E o dashboard inteiro (Produtos, Pedidos, Clientes, Financeiro,
 * Estoque, Clube...), este ultimo apenas escondido com `hidden`. Qualquer
 * visitante baixava a planta completa do sistema no "ver codigo-fonte".
 * Nenhum DADO vazava — as 31 rotas de /api/admin/* passam por
 * requireAdminSession() e respondem 401 sem sessao —, mas a estrutura, sim.
 *
 * Agora:
 *   /painel      -> painel/index.html  (so o formulario de login, publico)
 *   /painel/app  -> esta funcao        (valida a sessao ANTES de responder)
 *
 * O HTML do dashboard mora em api/_private/dashboard.html. Nada dentro de
 * api/ e servido estaticamente pelo Vercel, entao o arquivo so sai daqui.
 * A leitura usa um caminho literal com __dirname de proposito: e o padrao que
 * o tracer do Vercel (@vercel/nft) reconhece para embarcar o arquivo junto da
 * funcao. O conteudo fica em cache no modulo, entao o disco e lido uma vez
 * por instancia, nao a cada requisicao.
 */
const fs = require('fs');
const path = require('path');
const { requireAdminSession } = require('./_lib/auth');

const DASHBOARD_PATH = path.join(__dirname, '_private', 'dashboard.html');

let cachedHtml = null;
function readDashboard() {
  if (cachedHtml === null) cachedHtml = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  return cachedHtml;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send('Método não permitido.');
    return;
  }

  // O HTML e lido ANTES da checagem de sessao, de proposito. Nao e leitura
  // cara (fica em cache no modulo depois da primeira vez) e serve de teste de
  // fumaca do deploy: se o includeFiles do vercel.json nao tiver embarcado
  // api/_private/dashboard.html junto da funcao, a rota responde 500 para
  // qualquer um — da para descobrir isso num preview, sem precisar logar, em
  // vez de so notar quando o Arthur tentar entrar no painel.
  // Nao vaza nada: a diferenca entre 500 e 302 revela apenas se um arquivo
  // existe no bundle, jamais o conteudo dele.
  let html;
  try {
    html = readDashboard();
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end('Painel indisponível: o HTML do dashboard não foi embarcado no deploy.');
    return;
  }

  // Sem sessao valida o visitante volta para o login, sem nunca receber o
  // HTML do dashboard. requireAdminSession escreve um 401 JSON por conta
  // propria; aqui a resposta certa e um redirect, entao a checagem e feita
  // com um `res` de mentira que absorve aquela resposta.
  const silent = {
    status() { return silent; },
    json() { return silent; },
    setHeader() { return silent; },
    end() { return silent; },
  };
  const session = await requireAdminSession(req, silent);
  if (!session) {
    res.statusCode = 302;
    res.setHeader('Location', '/painel');
    res.setHeader('Cache-Control', 'no-store');
    res.end();
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // nunca cachear: a resposta depende do cookie de sessao
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(req.method === 'HEAD' ? '' : html);
};
