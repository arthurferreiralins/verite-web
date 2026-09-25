/**
 * Banner "Revelação" — cena de abertura da home em três atos.
 * Ver o comentário grande no topo de #inicio em index.html e o bloco
 * "BANNER PRINCIPAL" em assets/css/style.css.
 *
 * Este arquivo faz três coisas e nada mais:
 *
 *  1. PROGRESSO. Traduz a rolagem dentro da seção alta num número --p (0→1)
 *     e nas variáveis derivadas que o CSS lê (--op-open, --op-word,
 *     --op-collection, --mv-*). Todo o desenho de layout é CSS; aqui só sai
 *     número. As janelas de opacidade são DISJUNTAS de propósito: nenhum ato
 *     divide a tela com outro enquanto houver texto legível nos dois.
 *
 *  2. PARTÍCULAS. Um canvas só, que serve de névoa no ato 1, monta a palavra
 *     "VERITÉ" no ato 2 (posições amostradas de um canvas fora de tela, na
 *     fonte da marca) e se dissolve no ato 3.
 *
 *  3. PARALLAX. Um deslocamento mínimo do feixe de luz e da névoa conforme o
 *     ponteiro. Só com ponteiro fino; em toque a luz tem vida própria pelo
 *     keyframe CSS.
 *
 * PROGRESSIVE ENHANCEMENT: nada disso liga sem JS, em tela ≤900px ou com
 * `prefers-reduced-motion`. Nesses casos a seção é uma pilha estática e o
 * conteúdo todo está visível — o CSS cuida disso sozinho. Qualquer uma das
 * condições mudando ao vivo liga/desliga o modo na hora.
 */
(function () {
  'use strict';

  var hero = document.querySelector('#inicio.hero-scene');
  if (!hero) return;

  var pin = hero.querySelector('.scene-pin');
  var stage = hero.querySelector('[data-rev-stage]');
  var canvas = hero.querySelector('[data-rev-canvas]');
  var actOpen = hero.querySelector('[data-rev-act="open"]');
  var actCollection = hero.querySelector('[data-rev-act="collection"]');
  var cue = hero.querySelector('[data-rev-cue]');
  var set = hero.querySelector('.rev-set');
  if (!pin || !stage || !actOpen || !actCollection) return;

  var mqWide = window.matchMedia ? window.matchMedia('(min-width:901px)') : { matches: true };
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  /* rampa linear entre dois pontos, já saturada nas pontas */
  function ramp(v, a, b) { return clamp01((v - a) / (b - a)); }
  function setVar(name, value) { hero.style.setProperty(name, value); }

  var enhanced = false;
  var ticking = false;
  var progress = 0;

  /* -------------------------------------------------------------------
     1. Progresso e repartição dos atos
     ------------------------------------------------------------------- */
  /* DUAS LINHAS DO TEMPO.
     -------------------------------------------------------------------
     SEM_FILME é a cena de estúdio sozinha, como está hoje: abertura, a
     palavra em poeira dourada, a coleção. É o que roda enquanto não
     existirem os quadros da sequência em assets/hero-seq/.

     COM_FILME entra quando hero-sequence.js encontra o manifesto e marca
     a seção com .tem-sequencia. Aí a abertura de estúdio SAI da frente e
     vira o final: o filme ocupa 0→88% (os textos dele estão em
     .rev-film-line, ver style.css) e só nos últimos 12% a cena de estúdio
     com os CTAs entra, seguida dos 4 frascos — exatamente a emenda pedida
     no conceito. Nada é recriado: são os mesmos .rev-act-open e
     .rev-act-collection nos dois casos.

     Em ambas, as janelas são DISJUNTAS: o ato que sai zera antes de o
     seguinte passar de um fiapo de opacidade. */
  var SEM_FILME = {
    openIn: null,
    openOut: [0.22, 0.30],
    wordIn: [0.30, 0.42],
    wordOut: [0.52, 0.62],
    collectionIn: [0.58, 0.76]
  };
  var COM_FILME = {
    /* 66–84% é onde o conceito pede as partículas formando "VERITÉ" sobre
       o céu; 88–100% é a emenda com o estúdio e depois a coleção. */
    openIn: [0.88, 0.94],
    openOut: null,
    wordIn: [0.66, 0.74],
    wordOut: [0.80, 0.86],
    collectionIn: [0.95, 1.00]
  };
  var ATO = SEM_FILME;

  /* hero-sequence.js chama isto quando acha os quadros */
  function usarLinhaDoTempoDoFilme() {
    ATO = COM_FILME;
    render();
  }
  hero.addEventListener('rev:tem-sequencia', usarLinhaDoTempoDoFilme);

  function render() {
    ticking = false;

    var alturaSecao = hero.offsetHeight;
    var alturaPalco = pin.offsetHeight;
    var percurso = alturaSecao - alturaPalco;
    var topo = hero.getBoundingClientRect().top;
    /* O palco gruda em `top: var(--header-h-compact)` — ele ocupa a área
       ABAIXO do cabeçalho, não a tela inteira. Então o progresso começa a
       contar quando o topo da seção alcança ESSE offset, não o topo da
       janela; sem descontar, --p ficaria adiantado e a cena terminaria
       antes de o palco se soltar. */
    var offsetPalco = parseFloat(getComputedStyle(pin).top) || 0;
    var p = percurso > 0 ? clamp01((offsetPalco - topo) / percurso) : 0;
    progress = p;

    /* openIn e openOut são mutuamente exclusivos: sem filme a abertura já
       começa na tela e só sai; com filme ela não existe até os 88% e aí
       entra para ficar. */
    var opOpen = ATO.openIn
      ? ramp(p, ATO.openIn[0], ATO.openIn[1])
      : 1 - ramp(p, ATO.openOut[0], ATO.openOut[1]);
    var opWord = Math.min(ramp(p, ATO.wordIn[0], ATO.wordIn[1]),
                          1 - ramp(p, ATO.wordOut[0], ATO.wordOut[1]));
    var opCollection = ramp(p, ATO.collectionIn[0], ATO.collectionIn[1]);

    setVar('--p', p.toFixed(4));
    setVar('--op-open', opOpen.toFixed(4));
    setVar('--op-word', opWord.toFixed(4));
    setVar('--op-collection', opCollection.toFixed(4));
    /* deslocamentos suaves, para os atos entrarem/saírem com movimento */
    setVar('--mv-open', (ATO.openIn ? 1 - opOpen : ramp(p, 0, ATO.openOut[1])).toFixed(4));
    setVar('--mv-collection', opCollection.toFixed(4));
    setVar('--op-cue', (1 - ramp(p, 0, 0.10)).toFixed(4));

    /* o palco só encosta no topo depois que a seção gruda; antes disso a
       composição precisa se centrar no espaço ABAIXO do cabeçalho, que
       ainda está em cima dela no fluxo */
    hero.classList.toggle('is-pinned', topo <= offsetPalco + 0.5);

    /* quem está invisível não pode receber clique nem foco de teclado */
    actOpen.classList.toggle('rev-idle', opOpen <= 0.02);
    actCollection.classList.toggle('rev-idle', opCollection <= 0.02);
    if (cue) cue.style.pointerEvents = (1 - ramp(p, 0, 0.10)) <= 0.05 ? 'none' : '';

    /* Uma única fonte de verdade para o progresso: hero-sequence.js escuta
       isto para escolher o quadro do filme, em vez de manter a própria
       conta de rolagem (duas contas divergem cedo ou tarde). */
    hero.dispatchEvent(new CustomEvent('rev:progresso', { detail: { p: p } }));
  }

  function requestRender() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(render); }
  }

  /* -------------------------------------------------------------------
     2. Névoa, partículas e a palavra
     ------------------------------------------------------------------- */
  var particulas = null;

  function iniciarParticulas() {
    if (particulas) { particulas.ligar(); return; }
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    var W = 0, H = 0, DPR = 1;
    var itens = [];
    var alvos = [];
    var rodando = false;
    var naTela = true;
    var raf = 0;
    var px = 0, py = 0, cx = 0, cy = 0; /* parallax do ponteiro */

    /* O banner é a primeira seção, mas a home é longa: sem isto o canvas
       continuaria desenhando o tempo todo com o visitante lá embaixo lendo
       o Clube. Com o observer, fora da tela o loop vira um no-op. */
    if ('IntersectionObserver' in window) {
      new window.IntersectionObserver(function (entradas) {
        naTela = entradas[0].isIntersecting;
        if (naTela && rodando && !raf) raf = window.requestAnimationFrame(quadro);
      }, { rootMargin: '120px' }).observe(hero);
    }

    /* Desenha "VERITÉ" UMA VEZ num canvas fora de tela e guarda tanto o
       bitmap quanto uma amostra das posições dos pixels das letras.
       -----------------------------------------------------------------
       Por que assim, e não com as partículas desenhando as letras: tentei
       primeiro construir a palavra só com poeira. Para a letra ficar
       legível era preciso quase mil partículas, e mesmo assim lia como uma
       faixa de pó — e o quadro caía para 4fps (renderizador por software).
       Agora a palavra é TEXTO de verdade (um único drawImage por quadro,
       custo desprezível) e as partículas, bem menos numerosas, convergem
       PARA os pixels dela. A leitura é a mesma — a névoa se condensa na
       palavra — e sobra desempenho de sobra. */
    var bitmapPalavra = null, palavraX = 0, palavraY = 0;

    /* Sprite da poeira: UM ponto redondo e macio, desenhado uma única vez
       num canvas de 32px. Cada partícula é só um drawImage dele.
       -----------------------------------------------------------------
       As duas tentativas anteriores foram ruins de um jeito ou de outro:
       um gradiente radial POR partícula custava caríssimo, e fillRect
       (barato) deixava quadradinhos visíveis — feio num banner premium.
       Um blur de CSS no canvas resolvia a aparência, mas voltava a custar
       ~380ms por quadro em máquina sem aceleração. Sprite + drawImage tem
       a aparência do primeiro com o preço do segundo. */
    var sprite = (function () {
      var c = document.createElement('canvas');
      c.width = c.height = 32;
      var g2 = c.getContext('2d');
      if (!g2) return null;
      var g = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,238,204,1)');
      g.addColorStop(0.35, 'rgba(236,209,158,.55)');
      g.addColorStop(1, 'rgba(236,209,158,0)');
      g2.fillStyle = g;
      g2.fillRect(0, 0, 32, 32);
      return c;
    })();

    function medirPalavra() {
      alvos = [];
      bitmapPalavra = null;
      if (!W || !H) return;
      var off = document.createElement('canvas');
      /* Palavra deliberadamente MENOR que a tela: com um número fixo de
         partículas, quanto maior a letra mais fino fica o traço e menos ela
         se lê. Em 900px de largura o "VERITÉ" virava uma faixa de poeira. */
      var larguraAlvo = Math.min(W * 0.58, 760);
      var tamanho = Math.round(larguraAlvo / 4.6);
      off.width = Math.round(larguraAlvo);
      off.height = Math.round(tamanho * 1.6);
      var octx = off.getContext('2d');
      if (!octx) return;
      /* dourado da marca, com um halo suave — é este bitmap que aparece */
      octx.shadowColor = 'rgba(233,204,150,.55)';
      octx.shadowBlur = Math.round(tamanho * 0.22);
      octx.fillStyle = '#efd7a6';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = '500 ' + tamanho + 'px "Cormorant Garamond", Georgia, serif';
      /* o espaçamento largo é a assinatura tipográfica da marca */
      var texto = 'VERITÉ';
      var espaco = tamanho * 0.16;
      var larguraTotal = octx.measureText(texto).width + espaco * (texto.length - 1);
      var x = (off.width - larguraTotal) / 2;
      for (var i = 0; i < texto.length; i++) {
        var ch = texto[i];
        var w = octx.measureText(ch).width;
        octx.fillText(ch, x + w / 2, off.height / 2);
        x += w + espaco;
      }
      var dados = octx.getImageData(0, 0, off.width, off.height).data;
      /* pontos de destino das partículas: passo grosso serve, porque quem
         desenha a letra agora é o bitmap; a poeira só precisa pousar nela */
      var passo = Math.max(3, Math.round(off.width / 170));
      palavraX = (W - off.width) / 2;
      palavraY = H * 0.46 - off.height / 2;
      for (var y = 0; y < off.height; y += passo) {
        for (var xx = 0; xx < off.width; xx += passo) {
          if (dados[(y * off.width + xx) * 4 + 3] > 150) {
            alvos.push({ x: palavraX + xx, y: palavraY + y });
          }
        }
      }
      bitmapPalavra = off;
    }

    function dimensionar() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      medirPalavra();
      semear();
    }

    function semear() {
      /* Muita partícula pequena, não pouca e grande: são elas que precisam
         DESENHAR "VERITÉ". Uma a cada ~1.500px² dá ~860 em 1440x900, e o
         desenho continua barato porque todas entram num único path por
         faixa de brilho (ver quadro()) — três fills por quadro no total. */
      var n = Math.max(120, Math.min(300, Math.round((W * H) / 5200)));
      if (alvos.length) n = Math.min(n, alvos.length);
      itens = [];
      for (var i = 0; i < n; i++) {
        var alvo = alvos.length ? alvos[Math.floor((i / n) * alvos.length)] : null;
        itens.push({
          /* casa: a névoa, concentrada na metade de baixo, perto do piso */
          hx: Math.random() * W,
          hy: H * 0.42 + Math.random() * H * 0.58,
          x: Math.random() * W,
          y: Math.random() * H,
          tx: alvo ? alvo.x : W / 2,
          ty: alvo ? alvo.y : H / 2,
          r: 0.55 + Math.random() * 0.85,
          v: 0.25 + Math.random() * 0.75,
          fase: Math.random() * 6.2832,
          osc: 0.1 + Math.random() * 0.4,
          faixa: i % 3 /* 0 = fraca, 1 = média, 2 = forte */
        });
      }
    }

    function quadro(t) {
      if (!rodando) { raf = 0; return; }
      raf = window.requestAnimationFrame(quadro);
      if (!W || !H || !naTela) return;

      var p = progress;
      var forcaPalavra = Math.min(ramp(p, ATO.wordIn[0], ATO.wordIn[1]),
                                  1 - ramp(p, ATO.wordOut[0], ATO.wordOut[1]));
      /* a névoa vai sumindo conforme a palavra se forma, e não volta */
      var forcaNevoa = 1 - ramp(p, 0.18, 0.34);
      var saida = ramp(p, ATO.wordOut[1], 0.72); /* dissolve no fim do ato 2 */

      cx += (px - cx) * 0.05;
      cy += (py - cy) * 0.05;

      ctx.clearRect(0, 0, W, H);

      var alfaBase = ((0.05 + forcaNevoa * 0.06) + forcaPalavra * 0.55) * (1 - saida);
      if (alfaBase <= 0.004) return;

      /* DESENHO BARATO, de propósito. Três tentativas até chegar aqui:
         gradiente radial por partícula (lindo e lentíssimo), depois Path2D
         com arc() em `lighter` (ainda travava a captura em 30s). O que
         sobrou é o que roda liso: um fillRect por partícula, agrupado em
         três faixas de brilho = três trocas de fillStyle por quadro. Em
         1-2px um quadrado e um círculo são indistinguíveis, e a suavidade
         vem de um blur de CSS no próprio <canvas>, que é composto na GPU
         e não custa nada por quadro. */
      var faixas = [[], [], []];
      /* na névoa o ponto é maior e mais difuso; na palavra ele fecha e
         endurece, senão as letras borram e viram poeira ilegível */
      var escala = 2.1 - forcaPalavra * 1.0;

      for (var i = 0; i < itens.length; i++) {
        var m = itens[i];

        /* deriva lenta da névoa */
        m.hy -= m.v * 0.35;
        if (m.hy < H * 0.30) m.hy = H;
        var nx = m.hx + Math.sin(t / 1400 + m.fase) * 14 * m.osc + cx * 14;
        var ny = m.hy + Math.cos(t / 1700 + m.fase) * 8 * m.osc + cy * 8;

        /* destino = mistura entre a casa (névoa) e o ponto da letra */
        var destX = nx + (m.tx - nx) * forcaPalavra;
        var destY = ny + (m.ty - ny) * forcaPalavra;
        /* Aproximação bem mais firme quando a palavra está se formando: com
           passo lento as partículas ficavam "a caminho" da letra durante
           toda a janela e o efeito lia como poeira, nunca como texto. */
        var passo = 0.09 + forcaPalavra * 0.26;
        m.x += (destX - m.x) * passo;
        m.y += (destY - m.y) * passo;

        /* o sprite é macio nas bordas, então vale desenhá-lo maior que o
           "raio" nominal da partícula — o miolo é que vira o ponto */
        var lado = m.r * escala * 5;
        var f = faixas[m.faixa];
        f.push(m.x - lado / 2, m.y - lado / 2, lado);
      }

      var pesos = [0.55, 0.85, 1.15];
      for (var k = 0; k < 3; k++) {
        var a = Math.min(1, alfaBase * pesos[k]);
        if (a <= 0.004 || !sprite) continue;
        ctx.globalAlpha = a;
        var lista = faixas[k];
        for (var j = 0; j < lista.length; j += 3) {
          ctx.drawImage(sprite, lista[j], lista[j + 1], lista[j + 2], lista[j + 2]);
        }
      }
      ctx.globalAlpha = 1;

      /* A PALAVRA: um drawImage do bitmap pronto. Entra depois da poeira já
         estar a caminho (por isso o expoente, que segura o começo) e sai com
         ela. É a parte legível do ato 2 — a poeira é o movimento, o bitmap é
         o texto. */
      if (bitmapPalavra && forcaPalavra > 0.01) {
        var aPalavra = Math.pow(forcaPalavra, 1.8) * (1 - saida);
        if (aPalavra > 0.004) {
          ctx.globalAlpha = Math.min(1, aPalavra);
          ctx.drawImage(bitmapPalavra, palavraX, palavraY);
          ctx.globalAlpha = 1;
        }
      }
    }

    function aoMover(e) {
      if (e.pointerType === 'touch') return;
      var r = hero.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
      if (set) set.style.setProperty('--par-x', (px * 18).toFixed(2) + 'px');
      if (set) set.style.setProperty('--par-y', (py * 12).toFixed(2) + 'px');
    }

    particulas = {
      ligar: function () {
        if (rodando) return;
        rodando = true;
        dimensionar();
        if (!raf) raf = window.requestAnimationFrame(quadro);
      },
      desligar: function () {
        rodando = false;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
        if (W && H) ctx.clearRect(0, 0, W, H);
      },
      redimensionar: dimensionar
    };

    window.addEventListener('resize', function () { if (rodando) dimensionar(); }, { passive: true });
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      hero.addEventListener('pointermove', aoMover, { passive: true });
      hero.addEventListener('pointerleave', function () {
        px = 0; py = 0;
        if (set) { set.style.setProperty('--par-x', '0px'); set.style.setProperty('--par-y', '0px'); }
      });
    }
    /* as letras dependem da fonte da marca: remede quando ela chegar */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (rodando) dimensionar(); });
    }
    particulas.ligar();
  }

  /* -------------------------------------------------------------------
     3. Liga/desliga o modo cinematográfico
     ------------------------------------------------------------------- */
  /* Com FILME o modo grudado vale em qualquer largura: o conceito tem uma
     sequência própria em 9:16 para o celular, então desligar abaixo de
     901px deixaria o mobile sem filme nenhum. Sem filme, segue a regra
     antiga — a cena de estúdio em tela estreita é uma pilha estática, que
     é mais leve e não sequestra a rolagem. Movimento reduzido desliga tudo
     nos dois casos, sem exceção. */
  var temFilme = false;
  hero.addEventListener('rev:tem-sequencia', function () {
    temFilme = true;
    sincronizar();
  });

  function deveLigar() {
    if (mqReduce.matches || !('requestAnimationFrame' in window)) return false;
    return !!(mqWide.matches || temFilme);
  }

  function ligar() {
    if (enhanced) return;
    enhanced = true;
    hero.classList.add('rev-enhanced');
    render();
    window.requestAnimationFrame(function () { hero.classList.add('rev-ready'); });
    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestRender, { passive: true });
    iniciarParticulas();
  }

  function desligar() {
    if (!enhanced) return;
    enhanced = false;
    hero.classList.remove('rev-enhanced', 'rev-ready', 'is-pinned');
    window.removeEventListener('scroll', requestRender);
    window.removeEventListener('resize', requestRender);
    actOpen.classList.remove('rev-idle');
    actCollection.classList.remove('rev-idle');
    if (cue) cue.style.pointerEvents = '';
    if (particulas) particulas.desligar();
  }

  function sincronizar() { if (deveLigar()) ligar(); else desligar(); }

  sincronizar();
  ['change'].forEach(function (ev) {
    if (mqWide.addEventListener) mqWide.addEventListener(ev, sincronizar);
    else if (mqWide.addListener) mqWide.addListener(sincronizar);
    if (mqReduce.addEventListener) mqReduce.addEventListener(ev, sincronizar);
    else if (mqReduce.addListener) mqReduce.addListener(sincronizar);
  });

  /* imagens e fontes chegando depois do primeiro paint mudam a altura real
     da seção — um recálculo tardio evita que --p comece torto */
  window.addEventListener('load', function () { if (enhanced) { render(); if (particulas) particulas.redimensionar(); } });
})();
