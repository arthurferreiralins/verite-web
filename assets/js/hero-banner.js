/**
 * Banner principal da home ("Descubra Sua Essência").
 *
 * Sequência de entrada cinematográfica + parallax de mouse muito sutil +
 * partículas douradas lentas num <canvas>. O flutuar contínuo do frasco
 * é 100% CSS (keyframe hb-float).
 *
 * A seção #inicio.hero-home nasce "parada" (textos em opacity:0, grade e
 * partículas em opacity:0). A classe .hb-ready — adicionada aqui — dispara
 * a entrada encadeada, que é toda descrita em CSS, logo no carregamento.
 * Tudo desliga em prefers-reduced-motion, e o parallax + as partículas
 * também desligam em ponteiro grosso (touch).
 *
 * Parallax: camadas com [data-hb-depth] deslizam poucos px na direção
 * oposta ao cursor; [data-hb-invert] inverte o sentido (o frasco reage
 * em direção diferente do fundo). Efeito propositalmente mínimo.
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

  // revela o banner logo após o primeiro frame
  window.requestAnimationFrame(function(){ window.setTimeout(go, 60); });

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

    hero.addEventListener('pointerleave', function(){
      tx = 0; ty = 0;
      if(!running){ running = true; window.requestAnimationFrame(loop); }
    });

    function loop(){
      cx += (tx - cx) * 0.05;
      cy += (ty - cy) * 0.05;
      for(var i = 0; i < layers.length; i++){
        var el = layers[i];
        var d = parseFloat(el.getAttribute('data-hb-depth')) || 0;
        var inv = el.hasAttribute('data-hb-invert') ? -1 : 1;
        var mx = cx * d * 56 * inv;
        var my = cy * d * 56 * inv;
        el.style.transform = 'translate3d(' + mx.toFixed(2) + 'px,' + my.toFixed(2) + 'px,0)';
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
        r: 0.4 + Math.random() * 1.3,
        v: 1.0 + Math.random() * 3.4,
        a: 0.03 + Math.random() * 0.14,
        ph: Math.random() * 6.28,
        sw: 0.13 + Math.random() * 0.4
      };
    }

    function seed(){
      var n = Math.max(12, Math.min(34, Math.round((W * H) / 30000)));
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
