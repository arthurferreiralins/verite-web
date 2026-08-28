/**
 * Banner principal da home ("Descubra Sua Essência").
 *
 * Sequência de entrada + parallax de mouse muito sutil + partículas
 * douradas lentas num <canvas>.
 *
 * A seção #inicio.hero-home nasce "parada" (textos em opacity:0, grade e
 * partículas em opacity:0). A classe .hb-ready — adicionada aqui — dispara
 * a entrada encadeada, que é toda descrita em CSS. O disparo espera a
 * animação de abertura (.verite-intro) terminar, para que os textos não
 * entrem atrás da cortina preta; há um fallback por tempo caso o evento
 * não chegue. Tudo desliga em prefers-reduced-motion, e o parallax +
 * as partículas também desligam em ponteiro grosso (touch).
 */
(function(){
  'use strict';

  var hero = document.querySelector('#inicio.hero-home');
  if(!hero) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(){ hero.classList.add('hb-ready'); }

  if(reduceMotion){
    ready();
    return;
  }

  var done = false;
  function go(){
    if(done) return;
    done = true;
    ready();
    initParallax();
    initParticles();
  }

  var intro = document.querySelector('.verite-intro');
  if(intro){
    // revela assim que a cortina de abertura termina de sair
    intro.addEventListener('animationend', function(e){
      if(e.animationName === 'verite-intro-exit') go();
    });
    // fallback: se o animationend não vier (aba em segundo plano, etc.)
    window.setTimeout(go, 3600);
  } else {
    window.requestAnimationFrame(function(){ window.setTimeout(go, 60); });
  }

  /* ---------------------------------------------------------------------
     Parallax de mouse — desktop, ponteiro fino apenas. Cada camada com
     [data-hb-depth] desliza alguns pixels na direção oposta ao cursor,
     com forte suavização (lerp) para nunca parecer "nervoso".
     --------------------------------------------------------------------- */
  function initParallax(){
    var fine = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if(!fine) return;

    var layers = Array.prototype.slice.call(hero.querySelectorAll('[data-hb-depth]'));
    if(!layers.length) return;

    var tx = 0, ty = 0, cx = 0, cy = 0, running = false;

    hero.addEventListener('pointermove', function(e){
      var r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if(!running){ running = true; window.requestAnimationFrame(loop); }
    }, {passive:true});

    hero.addEventListener('pointerleave', function(){ tx = 0; ty = 0; });

    function loop(){
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      for(var i = 0; i < layers.length; i++){
        var d = parseFloat(layers[i].getAttribute('data-hb-depth')) || 0;
        layers[i].style.transform =
          'translate3d(' + (cx * d * 90).toFixed(2) + 'px,' + (cy * d * 90).toFixed(2) + 'px,0)';
      }
      if(Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005){
        window.requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }
  }

  /* ---------------------------------------------------------------------
     Partículas douradas — poucas, lentas, sobem flutuando devagar. Puro
     canvas 2d com blending aditivo; a contagem escala com a área e é
     limitada para nunca pesar. Sem canvas/contexto disponível, o banner
     simplesmente fica sem partículas.
     --------------------------------------------------------------------- */
  function initParticles(){
    var cv = hero.querySelector('.hb-particles');
    var ctx = cv && cv.getContext && cv.getContext('2d');
    if(!ctx) return;

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
        r: 0.5 + Math.random() * 1.8,
        v: 1.2 + Math.random() * 4.2,
        a: 0.04 + Math.random() * 0.20,
        ph: Math.random() * 6.28,
        sw: 0.15 + Math.random() * 0.45
      };
    }

    function seed(){
      var n = Math.max(14, Math.min(44, Math.round((W * H) / 24000)));
      dust = [];
      for(var i = 0; i < n; i++) dust.push(mk(true));
    }

    function tick(t){
      if(W && H){
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for(var i = 0; i < dust.length; i++){
          var m = dust[i];
          m.y -= m.v / 60;
          m.x += Math.sin(t / 1000 * m.sw + m.ph) * 0.12;
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
})();
