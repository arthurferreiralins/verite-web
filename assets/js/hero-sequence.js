/**
 * Banner "Impossível de ignorar" — sequência de imagens controlada pela
 * rolagem (a técnica das páginas de produto da Apple).
 *
 * A seção #inicio é alta e tem um palco `position:sticky` por dentro. A
 * rolagem dentro dela vira um progresso 0→1; esse progresso escolhe qual
 * quadro da sequência é desenhado no <canvas>. O resultado é um filme que
 * a pessoa "toca" com o dedo/scroll, para e volta à vontade.
 *
 * OS QUADROS vêm de assets/hero-seq/{desktop,mobile}/NNNN.webp, gerados a
 * partir dos vídeos por tools/extrair-quadros.js. A contagem sai de
 * assets/hero-seq/manifest.json — nenhum número fica escrito aqui, então
 * regerar a sequência com mais ou menos quadros não pede mudança de código.
 *
 * ENQUANTO NÃO HOUVER QUADROS o arquivo não faz nada: sem manifest, a cena
 * de estúdio que já existe (hero-reveal.js) segue no ar exatamente como
 * está. É por isso que dá para publicar isto antes dos vídeos existirem.
 *
 * CUIDADOS QUE ESTE ARQUIVO TOMA
 *  - Primeira tela: carrega SÓ o quadro 1 e desenha assim que ele chega.
 *    Nada de tela preta esperando a sequência inteira.
 *  - Carregamento em três ondas: quadro 1 → 1 a cada 8 → todo o resto,
 *    sempre em segundo plano, sem bloquear nada.
 *  - Suavização (lerp): o quadro desenhado persegue o quadro-alvo, senão a
 *    rolagem rápida vira um tranco.
 *  - `navigator.connection.saveData`: fica só no pôster, não baixa sequência.
 *  - `prefers-reduced-motion`: nem entra em cena (o CSS mostra a versão
 *    estática).
 *  - Fora da tela, para de desenhar (IntersectionObserver).
 *  - `object-fit: cover` feito na mão no canvas, para o frasco nunca sair
 *    do quadro em proporções diferentes.
 */
(function () {
  'use strict';

  var hero = document.querySelector('#inicio.hero-scene');
  var canvas = hero && hero.querySelector('[data-seq-canvas]');
  if (!hero || !canvas) return;

  var BASE = 'assets/hero-seq/';
  var mqMobile = window.matchMedia ? window.matchMedia('(max-width: 767px)') : { matches: false };
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function economiaDeDados() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '')));
  }

  var ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  var perfil = mqMobile.matches ? 'mobile' : 'desktop';
  var total = 0;
  var imagens = [];      // Image por índice, undefined enquanto não carregou
  var carregados = 0;
  var quadroAtual = 0;   // o desenhado (suavizado)
  var quadroAlvo = 0;    // o que a rolagem pede
  var naTela = true;
  var raf = 0;
  var pronto = false;

  function caminho(i) {
    return BASE + perfil + '/' + String(i + 1).padStart(4, '0') + '.webp';
  }

  function carregar(i, prioridade) {
    if (imagens[i]) return Promise.resolve(imagens[i]);
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      if (prioridade) img.fetchPriority = 'high';
      img.onload = function () { imagens[i] = img; carregados++; resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = caminho(i);
    });
  }

  /* `object-fit: cover` na mão: o canvas tem o tamanho do palco e a imagem
     é recortada no centro, então o frasco (que está sempre no meio do
     quadro) nunca fica de fora, seja qual for a proporção da tela. */
  function desenhar(img) {
    if (!img) return;
    var W = canvas.width, H = canvas.height;
    var ri = img.width / img.height, rc = W / H;
    var sw, sh, sx, sy;
    if (ri > rc) { sh = img.height; sw = sh * rc; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / rc; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  }

  /* o quadro mais próximo que JÁ carregou — enquanto a sequência completa
     não chega, a cena continua mostrando algo coerente em vez de piscar */
  function maisProximoCarregado(alvo) {
    if (imagens[alvo]) return imagens[alvo];
    for (var d = 1; d < total; d++) {
      if (imagens[alvo - d]) return imagens[alvo - d];
      if (imagens[alvo + d]) return imagens[alvo + d];
    }
    return null;
  }

  function dimensionar() {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      desenhar(maisProximoCarregado(Math.round(quadroAtual)));
    }
  }

  function laco() {
    raf = 0;
    if (!naTela || !pronto) return;
    /* suavização: o quadro desenhado persegue o alvo. 0.18 dá uma inércia
       curta — some o tranco da rolagem rápida sem parecer atrasado. */
    var delta = quadroAlvo - quadroAtual;
    if (Math.abs(delta) < 0.01) { quadroAtual = quadroAlvo; }
    else { quadroAtual += delta * 0.18; raf = window.requestAnimationFrame(laco); }
    desenhar(maisProximoCarregado(Math.round(quadroAtual)));
  }

  function pedirQuadro(p) {
    if (!total) return;
    quadroAlvo = Math.max(0, Math.min(total - 1, p * (total - 1)));
    if (!raf && naTela && pronto) raf = window.requestAnimationFrame(laco);
  }

  /* --------------------------------------------------------------------
     Carregamento em três ondas
     -------------------------------------------------------------------- */
  function carregarEmOndas() {
    // onda 1: o pôster. Desenha assim que chega — é a primeira tela.
    carregar(0, true).then(function (img) {
      if (!img) return;
      pronto = true;
      dimensionar();
      desenhar(img);
      hero.classList.add('seq-pronto');

      if (economiaDeDados()) {
        /* pedido de economia de dados: para por aqui, com o pôster na tela
           e a cena de estúdio assumindo o resto */
        hero.classList.add('seq-poster-apenas');
        return;
      }

      // onda 2: um a cada 8, para dar "corpo" ao filme rápido
      var esparsos = [];
      for (var i = 8; i < total; i += 8) esparsos.push(i);
      Promise.all(esparsos.map(function (i) { return carregar(i); })).then(function () {
        // onda 3: todo o resto, em segundo plano, sem pressa
        var resto = [];
        for (var j = 1; j < total; j++) if (!imagens[j]) resto.push(j);
        (function proximo() {
          if (!resto.length) { hero.classList.add('seq-completo'); return; }
          var lote = resto.splice(0, 6).map(function (k) { return carregar(k); });
          Promise.all(lote).then(function () {
            if (window.requestIdleCallback) window.requestIdleCallback(proximo, { timeout: 500 });
            else window.setTimeout(proximo, 32);
          });
        })();
      });
    });
  }

  /* --------------------------------------------------------------------
     Textos do filme, sincronizados com a rolagem
     --------------------------------------------------------------------
     Cada linha declara no HTML a faixa em que vive (data-de / data-ate, em
     por cento). Aqui ela vira uma curva: entra num quarto da faixa, segura
     no meio, sai no último quarto. Como as faixas do conceito não se
     tocam (0-15, 18-38, 42-62, 66-84), duas linhas NUNCA ficam legíveis ao
     mesmo tempo — é a mesma regra dos atos da cena de estúdio.
     -------------------------------------------------------------------- */
  var linhas = [];
  var cue = hero.querySelector('[data-rev-film-cue]');

  function prepararTextos() {
    linhas = Array.prototype.slice.call(hero.querySelectorAll('.rev-film-line')).map(function (el) {
      return {
        el: el,
        de: parseFloat(el.getAttribute('data-de')) / 100,
        ate: parseFloat(el.getAttribute('data-ate')) / 100
      };
    });
  }

  function atualizarTextos(p) {
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i];
      var faixa = l.ate - l.de;
      var entrada = faixa * 0.28;
      var saida = faixa * 0.28;
      var o;
      /* A linha que começa em 0% não tem "entrada": ela já está na tela
         quando a página abre — a primeira tela precisa mostrar o quadro 1
         COM o texto, não esperar um pixel de rolagem para o texto surgir. */
      var semEntrada = l.de <= 0;
      if (p < l.de || p >= l.ate) o = 0;
      else if (!semEntrada && p < l.de + entrada) o = (p - l.de) / entrada;
      else if (p > l.ate - saida) o = (l.ate - p) / saida;
      else o = 1;
      o = o < 0 ? 0 : o > 1 ? 1 : o;
      l.el.style.setProperty('--op-line', o.toFixed(3));
    }
    if (cue) cue.style.setProperty('--op-cue', (1 - Math.min(1, p / 0.06)).toFixed(3));
  }

  /* --------------------------------------------------------------------
     Entrada
     -------------------------------------------------------------------- */
  if (mqReduce.matches) return; /* o CSS mostra a versão estática */

  fetch(BASE + 'manifest.json', { cache: 'force-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) {
      var cfg = m && m.perfis && m.perfis[perfil];
      if (!cfg || !cfg.quadros) return; /* sem quadros: nada muda no site */
      total = cfg.quadros;
      hero.classList.add('tem-sequencia');
      /* avisa hero-reveal.js para trocar a linha do tempo: a cena de
         estúdio deixa de abrir a seção e passa a ser a emenda final */
      hero.dispatchEvent(new CustomEvent('rev:tem-sequencia'));

      window.addEventListener('resize', dimensionar, { passive: true });
      if ('IntersectionObserver' in window) {
        new window.IntersectionObserver(function (e) {
          naTela = e[0].isIntersecting;
          if (naTela && !raf && pronto) raf = window.requestAnimationFrame(laco);
        }, { rootMargin: '150px' }).observe(hero);
      }
      /* hero-reveal.js é quem já calcula o progresso da seção; aqui só
         escutamos, para não existirem duas contas de rolagem divergentes */
      prepararTextos();
      hero.addEventListener('rev:progresso', function (ev) {
        pedirQuadro(ev.detail.p);
        atualizarTextos(ev.detail.p);
      });

      carregarEmOndas();
    })
    .catch(function () { /* sem manifesto, segue a cena de estúdio */ });
})();
