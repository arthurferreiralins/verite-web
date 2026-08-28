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
    initBottleInteract();
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

  /* ---------------------------------------------------------------------
     Interação com o frasco.
     Desktop (ponteiro fino): o frasco inclina em 3D acompanhando o
     cursor; clicar e arrastar "gira" o frasco (rotateY limitado) e ele
     volta sozinho ao soltar; um brilho especular acompanha o ponteiro e
     uma luz de recorte quente acende enquanto se segura. Tudo com lerp,
     só transform/opacity.
     Celular (ponteiro grosso): tocar no frasco dá um balanço curto e
     elegante (keyframe CSS). Nada depende de giroscópio.
     Desliga inteiro em prefers-reduced-motion (go() nem é chamado).
     --------------------------------------------------------------------- */
  function initBottleInteract(){
    var tilt  = hero.querySelector('.hb-bottle-tilt');
    var media = hero.querySelector('.hb-media');
    var frame = hero.querySelector('.hb-bottle-frame');
    var shine = hero.querySelector('.hb-shine');
    if(!tilt || !frame) return;

    var fine = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* ---- toque: balanço curto ---- */
    if(!fine){
      tilt.addEventListener('click', function(){
        tilt.classList.remove('is-tap');
        void tilt.offsetWidth;               /* reflow p/ reiniciar a animação */
        tilt.classList.add('is-tap');
        if(media) media.classList.add('is-bottle-live');
        window.setTimeout(function(){ if(media) media.classList.remove('is-bottle-live'); }, 900);
      });
      tilt.addEventListener('animationend', function(){ tilt.classList.remove('is-tap'); });
      return;
    }

    /* ---- desktop: tilt 3D + arrasto ---- */
    var rx = 0, ry = 0, trx = 0, tryy = 0;   /* rotX/rotY atual e alvo */
    var sx = 0, tsx = 0, sOp = 0;            /* brilho: posição (%) e opacidade */
    var raf = 0;
    var inside = false, dragging = false, dragId = null, dragStartX = 0, dragBaseRy = 0;

    function schedule(){ if(!raf) raf = window.requestAnimationFrame(loop); }

    function aim(clientX, clientY){
      var r = frame.getBoundingClientRect();
      var nx = (clientX - (r.left + r.width  / 2)) / (r.width  / 2);
      var ny = (clientY - (r.top  + r.height / 2)) / (r.height / 2);
      nx = nx < -1.4 ? -1.4 : nx > 1.4 ? 1.4 : nx;
      ny = ny < -1.4 ? -1.4 : ny > 1.4 ? 1.4 : ny;
      if(!dragging){ trx = -ny * 7; tryy = nx * 12; }
      tsx = nx * 26;
    }

    hero.addEventListener('pointermove', function(e){
      if(e.pointerType === 'touch') return;
      aim(e.clientX, e.clientY);
      if(dragging){
        var dx = e.clientX - dragStartX;
        tryy = Math.max(-24, Math.min(24, dragBaseRy + dx * 0.28));
        trx = 0;
      }
      schedule();
    }, {passive:true});

    hero.addEventListener('pointerleave', function(){
      trx = 0; tryy = 0; tsx = 0; schedule();
    });

    tilt.addEventListener('pointerenter', function(){
      inside = true;
      if(media) media.classList.add('is-bottle-live');
      schedule();
    });
    tilt.addEventListener('pointerleave', function(){
      inside = false;
      if(!dragging && media) media.classList.remove('is-bottle-live');
      schedule();
    });

    tilt.addEventListener('pointerdown', function(e){
      if(e.pointerType === 'touch') return;
      dragging = true; dragId = e.pointerId;
      dragStartX = e.clientX; dragBaseRy = tryy;
      tilt.classList.add('is-grabbing');
      try { tilt.setPointerCapture(e.pointerId); } catch(_){}
    });
    function endDrag(){
      if(!dragging) return;
      dragging = false;
      tilt.classList.remove('is-grabbing');
      try { tilt.releasePointerCapture(dragId); } catch(_){}
      if(!inside && media) media.classList.remove('is-bottle-live');
      schedule();
    }
    tilt.addEventListener('pointerup', endDrag);
    tilt.addEventListener('pointercancel', endDrag);

    function loop(){
      raf = 0;
      rx  += (trx  - rx)  * 0.12;
      ry  += (tryy - ry)  * 0.12;
      sx  += (tsx  - sx)  * 0.12;
      tilt.style.transform =
        'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      if(shine){
        var tOp = (inside || dragging) ? 0.9 : 0;
        sOp += (tOp - sOp) * 0.12;
        shine.style.opacity = sOp.toFixed(3);
        shine.style.transform = 'translateX(calc(-50% + ' + sx.toFixed(1) + '%))';
      }
      var settling =
        Math.abs(trx - rx) > 0.01 || Math.abs(tryy - ry) > 0.01 ||
        Math.abs(tsx - sx) > 0.05 ||
        (shine && Math.abs(((inside || dragging) ? 0.9 : 0) - sOp) > 0.01);
      if(settling || dragging || inside) schedule();
    }
  }
})();
