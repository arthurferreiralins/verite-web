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
     Interação com o frasco — responsiva, não lenta.
     Ponteiro fino (desktop): o frasco inclina em 3D acompanhando o
     cursor; hover dá um leve "avanço" (scale) + luz de recorte quente;
     clicar e arrastar gira o frasco 1:1 e, ao soltar, ele sai com
     inércia (flick) e assenta; clique seco dá um impulso rápido de giro.
     Um brilho especular acompanha o ponteiro. Passada de luz no vidro
     ao pegar.
     Ponteiro grosso (celular): arrastar o dedo gira o frasco (com
     inércia ao soltar); um toque seco dá um balanço curto (keyframe CSS).
     Nada depende de giroscópio. Tudo transform/opacity, um rAF com lerp.
     Desliga em prefers-reduced-motion (go() nem é chamado).
     --------------------------------------------------------------------- */
  function initBottleInteract(){
    var tilt  = hero.querySelector('.hb-bottle-tilt');
    var media = hero.querySelector('.hb-media');
    var frame = hero.querySelector('.hb-bottle-frame');
    var shine = hero.querySelector('.hb-shine');
    var sweep = hero.querySelector('.hb-sweep');
    if(!tilt || !frame) return;

    var fine = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    var rx = 0, ry = 0, sc = 1;        // atuais
    var trx = 0, tryy = 0, tsc = 1;    // alvos
    var sx = 0, tsx = 0, sOp = 0;      // brilho: posição (%) / opacidade
    var vry = 0;                        // velocidade angular (inércia)
    var raf = 0;
    var inside = false, dragging = false, dragId = null, lastX = 0, moved = 0;

    function schedule(){ if(!raf) raf = window.requestAnimationFrame(loop); }
    function setLive(on){
      if(!media) return;
      if(on) media.classList.add('is-bottle-live');
      else if(!inside && !dragging) media.classList.remove('is-bottle-live');
    }
    function flashSweep(){
      if(!sweep) return;
      sweep.classList.remove('is-sweeping');
      void sweep.offsetWidth;
      sweep.classList.add('is-sweeping');
    }
    if(sweep){
      sweep.addEventListener('animationend', function(){ sweep.classList.remove('is-sweeping'); });
    }

    function aimHover(x, y){
      var r = frame.getBoundingClientRect();
      var nx = (x - (r.left + r.width  / 2)) / (r.width  / 2);
      var ny = (y - (r.top  + r.height / 2)) / (r.height / 2);
      nx = nx < -1.5 ? -1.5 : nx > 1.5 ? 1.5 : nx;
      ny = ny < -1.5 ? -1.5 : ny > 1.5 ? 1.5 : ny;
      trx = -ny * 13;
      tryy = nx * 27;
      tsx = nx * 34;
    }

    /* hover (só ponteiro fino) */
    if(fine){
      hero.addEventListener('pointermove', function(e){
        if(e.pointerType === 'touch' || dragging) return;
        aimHover(e.clientX, e.clientY);
        schedule();
      }, {passive:true});
      hero.addEventListener('pointerleave', function(){
        if(dragging) return;
        trx = 0; tryy = 0; tsx = 0; schedule();
      });
      tilt.addEventListener('pointerenter', function(){
        inside = true; tsc = 1.035; setLive(true); schedule();
      });
      tilt.addEventListener('pointerleave', function(){
        inside = false; tsc = 1; setLive(false); schedule();
      });
    }

    /* arrasto — fino e grosso */
    tilt.addEventListener('pointerdown', function(e){
      dragging = true; dragId = e.pointerId; lastX = e.clientX; moved = 0; vry = 0;
      tilt.classList.add('is-grabbing');
      setLive(true); flashSweep();
      try { tilt.setPointerCapture(e.pointerId); } catch(_){}
      if(fine){ tsc = 1.05; schedule(); }   /* no touch, só agenda quando arrasta de fato */
    });
    tilt.addEventListener('pointermove', function(e){
      if(!dragging) return;
      var dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
      tryy = Math.max(-52, Math.min(52, tryy + dx * (fine ? 0.5 : 0.6)));
      vry  = dx * (fine ? 1.05 : 1.2);
      trx  = 0;
      tsx  = Math.max(-40, Math.min(40, tryy));
      schedule();
    }, {passive:true});
    function endDrag(e){
      if(!dragging) return;
      dragging = false;
      tilt.classList.remove('is-grabbing');
      try { tilt.releasePointerCapture(dragId); } catch(_){}

      if(moved < 6){
        if(fine){
          /* clique seco: impulso rápido de giro (feedback via JS) */
          var r = frame.getBoundingClientRect();
          var side = (e && typeof e.clientX === 'number')
            ? ((e.clientX - (r.left + r.width / 2)) >= 0 ? 1 : -1) : 1;
          vry += side * 11;
        } else {
          /* toque seco no celular: balanço curto via CSS, sem transform inline */
          tilt.style.transform = '';
          rx = ry = sx = 0; sc = 1; vry = 0;
          trx = tryy = tsx = 0; tsc = 1;
          tilt.classList.remove('is-tap');
          void tilt.offsetWidth;
          tilt.classList.add('is-tap');
          setLive(false);
          return;
        }
      }
      trx = 0; tryy = 0; tsx = 0;
      tsc = inside ? 1.035 : 1;
      setLive(false);
      schedule();
    }
    tilt.addEventListener('pointerup', endDrag);
    tilt.addEventListener('pointercancel', endDrag);
    tilt.addEventListener('animationend', function(){ tilt.classList.remove('is-tap'); });

    function loop(){
      raf = 0;

      if(dragging){
        ry = tryy;                                   // segue o cursor/dedo 1:1
      } else if(Math.abs(vry) > 0.06){
        ry += vry;                                   // inércia
        vry *= 0.85;
        ry += (tryy - ry) * 0.10;                    // + puxa de volta ao alvo
      } else {
        vry = 0;
        ry += (tryy - ry) * 0.26;                    // assenta rápido
      }
      ry = Math.max(-58, Math.min(58, ry));

      rx += (trx - rx) * 0.26;
      sc += (tsc - sc) * 0.22;
      sx += (tsx - sx) * 0.26;

      /* a perspectiva está no .hb-bottle-enter (CSS); aqui só o giro 3D */
      tilt.style.transform =
        'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) +
        'deg) scale(' + sc.toFixed(3) + ')';

      if(shine){
        var tOp = (inside || dragging || Math.abs(vry) > 0.5) ? 0.92 : 0;
        sOp += (tOp - sOp) * 0.26;
        shine.style.opacity = sOp.toFixed(3);
        shine.style.transform =
          'translateX(calc(-50% + ' + sx.toFixed(1) + '%)) translateZ(22px)';
      }

      var busy = dragging || inside ||
        Math.abs(trx - rx) > 0.02 || Math.abs(tryy - ry) > 0.02 ||
        Math.abs(tsc - sc) > 0.003 || Math.abs(vry) > 0.06 ||
        Math.abs(tsx - sx) > 0.1 || sOp > 0.02;
      if(busy){ schedule(); }
      else if(Math.abs(ry) < 0.05 && Math.abs(rx) < 0.05 && Math.abs(sc - 1) < 0.004){
        tilt.style.transform = '';   /* em repouso, o CSS volta a mandar sozinho */
      }
    }
  }
})();
