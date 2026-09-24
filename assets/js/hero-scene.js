/**
 * Cena de abertura da home — banner sem frascos + transformação real por
 * scroll (ver o bloco "BANNER PRINCIPAL" em assets/css/style.css).
 *
 * Progressive enhancement rígido: a seção já funciona 100% só com o HTML/
 * CSS (pilha estática, tudo visível, sem depender de JS nenhum). Este
 * arquivo só ACRESCENTA a versão cinematográfica — a classe
 * `.scene-enhanced` — quando três condições são verdadeiras ao mesmo
 * tempo: tela larga o bastante (min-width:901px, mesmo breakpoint do
 * CSS), o visitante não pediu movimento reduzido, e o navegador suporta
 * o básico (matchMedia + IntersectionObserver, ambos onipresentes hoje).
 * Qualquer uma dessas condições mudando ao vivo (resize, rotação,
 * alternar "reduzir movimento" no SO) liga/desliga o modo na hora — nunca
 * fica um estado quebrado preso na tela.
 *
 * No modo cinematográfico:
 *   --p           progresso bruto (0→1) da rolagem dentro da seção alta
 *   --band-p      = --p — desloca a faixa de luz dourada
 *   --op-brand    1→0 : a marca desaparece entre 40% e 70% do progresso
 *   --mv-brand    0→1 : a marca encolhe/sobe entre 0% e 55%
 *   --op-product  0→1 : o primeiro frasco surge entre 50% e 90%
 *   --mv-product  = --op-product (mesma janela, controla translateY/scale)
 *   --op-cue      1→0 : a dica de "role" some nos primeiros 12%
 * Todas calculadas aqui e lidas puramente em CSS (ver style.css) — nada
 * de recalcular layout dentro do loop além da leitura de getBoundingClientRect.
 */
(function(){
  'use strict';

  var hero = document.querySelector('#inicio.hero-scene');
  if(!hero) return;

  var stage  = hero.querySelector('.scene-stage');
  var brand  = hero.querySelector('.scene-brand');
  var product = hero.querySelector('.scene-product');
  var cue    = hero.querySelector('.scene-scrollcue');
  var bandOuter = hero.querySelector('.scene-band-outer');
  if(!stage || !brand || !product) return;

  var mqWide = window.matchMedia ? window.matchMedia('(min-width:901px)') : {matches:true};
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};

  function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
  function set(name, value){ hero.style.setProperty(name, value); }

  var enhanced = false;
  var ticking = false;

  function render(){
    ticking = false;
    var h = hero.offsetHeight, vh = window.innerHeight || document.documentElement.clientHeight;
    var scrollable = h - vh;
    var top = hero.getBoundingClientRect().top;
    var p = scrollable > 0 ? clamp01(-top / scrollable) : 0;

    var opBrand = clamp01(1 - (p - 0.40) / 0.30);
    var mvBrand = clamp01(p / 0.55);
    var opProduct = clamp01((p - 0.50) / 0.40);
    var opCue = clamp01(1 - p / 0.12);

    set('--p', p.toFixed(4));
    set('--band-p', p.toFixed(4));
    set('--op-brand', opBrand.toFixed(4));
    set('--mv-brand', mvBrand.toFixed(4));
    set('--op-product', opProduct.toFixed(4));
    set('--mv-product', opProduct.toFixed(4));
    set('--op-cue', opCue.toFixed(4));

    /* elementos quase invisíveis não devem continuar focáveis/clicáveis */
    brand.classList.toggle('scene-frame-idle', opBrand <= 0.02);
    product.classList.toggle('scene-frame-idle', opProduct <= 0.02);
    if(cue){
      cue.style.pointerEvents = opCue <= 0.05 ? 'none' : '';
    }
  }

  function requestRender(){
    if(!ticking){ ticking = true; window.requestAnimationFrame(render); }
  }

  /* ---------------------------------------------------------------------
     Parallax de mouse na faixa de luz — só ponteiro fino. Em telas de
     toque a faixa continua viva sozinha via o keyframe CSS `scene-silk`
     (autônomo, sem depender de nenhum evento de ponteiro) — essa é a
     "solução própria pra telas de toque" pedida: em vez de simular touch
     com JS, a luz simplesmente nunca fica parada, com ou sem ponteiro.
     --------------------------------------------------------------------- */
  var pointerBound = false;
  function bindPointer(){
    if(pointerBound || !bandOuter) return;
    var fine = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if(!fine) return;
    pointerBound = true;

    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    hero.addEventListener('pointermove', function(e){
      if(e.pointerType === 'touch') return;
      var r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if(!raf) raf = window.requestAnimationFrame(loop);
    }, {passive:true});
    hero.addEventListener('pointerleave', function(){
      tx = 0; ty = 0;
      if(!raf) raf = window.requestAnimationFrame(loop);
    });
    function loop(){
      raf = 0;
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      bandOuter.style.transform = 'translate3d(' + (cx * 26).toFixed(2) + 'px,' + (cy * 20).toFixed(2) + 'px,0)';
      if(Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = window.requestAnimationFrame(loop);
    }
  }

  /* ---------------------------------------------------------------------
     Partículas douradas discretas — só rodam no modo cinematográfico
     (mesma técnica leve de canvas 2d já usada no resto do site).
     --------------------------------------------------------------------- */
  var particlesStarted = false;
  function startParticles(){
    if(particlesStarted) return;
    var cv = hero.querySelector('.scene-particles');
    var ctx = cv && cv.getContext && cv.getContext('2d');
    if(!ctx) return;
    particlesStarted = true;

    var W = 0, H = 0, DPR = 1, dust = [];
    function size(){
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      if(!W || !H) return;
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }
    function mk(fresh){
      return {
        x: Math.random() * W,
        y: fresh ? Math.random() * H : H + 12,
        r: 0.4 + Math.random() * 1.2,
        v: 0.9 + Math.random() * 2.6,
        a: 0.03 + Math.random() * 0.1,
        ph: Math.random() * 6.28,
        sw: 0.12 + Math.random() * 0.35
      };
    }
    function seed(){
      var n = Math.max(8, Math.min(20, Math.round((W * H) / 46000)));
      dust = [];
      for(var i = 0; i < n; i++) dust.push(mk(true));
    }
    function tick(t){
      if(!enhanced) return; /* para sozinho se o modo desligar */
      if(W && H){
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for(var i = 0; i < dust.length; i++){
          var m = dust[i];
          m.y -= m.v / 60;
          m.x += Math.sin(t / 1000 * m.sw + m.ph) * 0.1;
          if(m.y < -14) dust[i] = mk(false);
          var rad = m.r * 4;
          var g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, rad);
          g.addColorStop(0, 'rgba(226,199,150,' + m.a + ')');
          g.addColorStop(1, 'rgba(226,199,150,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(m.x, m.y, rad, 0, 6.2832);
          ctx.fill();
        }
      }
      window.requestAnimationFrame(tick);
    }
    size();
    window.addEventListener('resize', size, {passive:true});
    window.requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------------
     Liga/desliga o modo cinematográfico conforme as condições mudam.
     --------------------------------------------------------------------- */
  function shouldEnhance(){
    return !!(mqWide.matches && !mqReduce.matches && 'IntersectionObserver' in window);
  }

  function enable(){
    if(enhanced) return;
    enhanced = true;
    hero.classList.add('scene-enhanced');
    render();
    window.requestAnimationFrame(function(){ hero.classList.add('scene-ready'); });
    window.addEventListener('scroll', requestRender, {passive:true});
    window.addEventListener('resize', requestRender, {passive:true});
    bindPointer();
    startParticles();
  }

  function disable(){
    if(!enhanced) return;
    enhanced = false;
    hero.classList.remove('scene-enhanced', 'scene-ready');
    window.removeEventListener('scroll', requestRender);
    window.removeEventListener('resize', requestRender);
    brand.classList.remove('scene-frame-idle');
    product.classList.remove('scene-frame-idle');
    if(cue) cue.style.pointerEvents = '';
    if(bandOuter) bandOuter.style.transform = '';
  }

  function sync(){
    if(shouldEnhance()) enable(); else disable();
  }

  sync();
  if(mqWide.addEventListener) mqWide.addEventListener('change', sync);
  else if(mqWide.addListener) mqWide.addListener(sync);
  if(mqReduce.addEventListener) mqReduce.addEventListener('change', sync);
  else if(mqReduce.addListener) mqReduce.addListener(sync);

  /* imagens/fontes chegando depois do primeiro paint podem mudar a altura
     real da seção — um recálculo tardio evita que --p comece torto */
  window.addEventListener('load', function(){ if(enhanced) render(); });
})();
