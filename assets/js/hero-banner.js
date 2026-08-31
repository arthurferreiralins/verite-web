/**
 * Banner principal da home ("Descubra Sua Essência").
 *
 * Vitrine de fragrância: um frasco Verité flutua num palco iluminado,
 * inclina levemente acompanhando o mouse, e as miniaturas abaixo trocam
 * a fragrância com uma passagem cinematográfica — a luz de fundo muda de
 * cor conforme o perfume (--tint) e uma passada de luz percorre o vidro.
 *
 * Entrada encadeada descrita em CSS, disparada pela classe .hb-ready.
 * Parallax de mouse (camadas [data-hb-depth]) + partículas douradas num
 * <canvas>. O flutuar contínuo é 100% CSS (keyframe hb-float).
 * Tudo desliga em prefers-reduced-motion (a troca de fragrância continua,
 * só sem animação).
 */
(function(){
  'use strict';

  var hero = document.querySelector('#inicio.hero-home');
  if(!hero) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(){ hero.classList.add('hb-ready'); }

  if(reduceMotion){
    ready();
    initFragrance();
    return;
  }

  var done = false;
  function go(){
    if(done) return;
    done = true;
    ready();
    initParallax();
    initParticles();
    initFragrance();
  }

  window.requestAnimationFrame(function(){ window.setTimeout(go, 60); });

  /* ---------------------------------------------------------------------
     Parallax de mouse — desktop, ponteiro fino. Cada camada [data-hb-depth]
     desliza alguns px na direção oposta ao cursor; [data-hb-invert] inverte.
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
        el.style.transform =
          'translate3d(' + (cx * d * 56 * inv).toFixed(2) + 'px,' + (cy * d * 56 * inv).toFixed(2) + 'px,0)';
      }
      if(Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005){
        window.requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }
  }

  /* ---------------------------------------------------------------------
     Partículas douradas — poucas, lentas, sobem flutuando. Canvas 2d,
     blending aditivo, contagem limitada.
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
     Fragrância: troca cinematográfica entre os frascos salvos + tilt de
     mouse + luz de fundo que muda de cor por perfume.
     --------------------------------------------------------------------- */
  function initFragrance(){
    var FRAGS = [
      { img:'assets/img/frasco-feminino.png', brand:'VÉRITÉ',        detail:'Feminino · Eau de Parfum · 50 ml', tint:'233,201,164', alt:'Perfume Verité Feminino — Eau de Parfum 50 ml' },
      { img:'assets/img/frasco-unisex.png',   brand:'VÉRITÉ DORÉA',  detail:'Eau de Parfum · 30 ml',            tint:'214,172,124', alt:'Perfume Verité Doréa — Eau de Parfum 30 ml' },
      { img:'assets/img/hero-frasco.png',     brand:'VÉRITÉ',        detail:'Eau de Parfum · 40 ml',            tint:'210,200,168', alt:'Perfume Verité — Eau de Parfum 40 ml' }
    ];

    var tilt   = hero.querySelector('.hb-bottle-tilt');
    var stage  = hero.querySelector('.hb-bottle-stage');
    var bottle = hero.querySelector('.hb-bottle');
    var sweep  = hero.querySelector('.hb-sweep');
    var shine  = hero.querySelector('.hb-shine');
    var nameEl = hero.querySelector('.hb-frag-name');
    var brandEl  = hero.querySelector('.hb-frag-brand');
    var detailEl = hero.querySelector('.hb-frag-detail');
    var btns = Array.prototype.slice.call(hero.querySelectorAll('.hb-switch-btn'));
    if(!stage || !bottle || !btns.length) return;

    var fine = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var cur = 0, switching = false;

    function flashSweep(){
      if(!sweep) return;
      sweep.classList.remove('is-sweeping');
      void sweep.offsetWidth;
      sweep.classList.add('is-sweeping');
    }
    if(sweep) sweep.addEventListener('animationend', function(){ sweep.classList.remove('is-sweeping'); });

    function paint(f, i){
      bottle.src = f.img; bottle.alt = f.alt;
      hero.style.setProperty('--tint', f.tint);
      if(brandEl) brandEl.textContent = f.brand;
      if(detailEl) detailEl.textContent = f.detail;
      btns.forEach(function(b, bi){
        b.classList.toggle('is-active', bi === i);
        b.setAttribute('aria-pressed', bi === i ? 'true' : 'false');
      });
    }

    function setFrag(i){
      if(i === cur || switching || !FRAGS[i]) return;
      var f = FRAGS[i], dir = i > cur ? 1 : -1;

      if(reduceMotion){ paint(f, i); cur = i; return; }

      switching = true;
      btns.forEach(function(b, bi){
        b.classList.toggle('is-active', bi === i);
        b.setAttribute('aria-pressed', bi === i ? 'true' : 'false');
      });
      if(nameEl) nameEl.classList.add('is-fading');
      stage.classList.remove('is-in', 'is-in-l', 'is-in-r');
      stage.classList.add('is-out', dir > 0 ? 'is-out-l' : 'is-out-r');

      window.setTimeout(function(){
        paint(f, i);
        if(nameEl) nameEl.classList.remove('is-fading');
        stage.classList.remove('is-out', 'is-out-l', 'is-out-r');
        void stage.offsetWidth;
        stage.classList.add('is-in', dir > 0 ? 'is-in-r' : 'is-in-l');
        flashSweep();
        cur = i;
      }, 340);

      window.setTimeout(function(){
        stage.classList.remove('is-in', 'is-in-l', 'is-in-r');
        switching = false;
      }, 1300);
    }

    btns.forEach(function(b){
      b.addEventListener('click', function(){ setFrag(parseInt(b.getAttribute('data-i'), 10) || 0); });
    });

    /* tilt de mouse — só ponteiro fino, sem movimento reduzido */
    if(fine && !reduceMotion && tilt){
      var rx = 0, ry = 0, trx = 0, tryy = 0, sop = 0, tsop = 0, sx = 0, tsx = 0, raf = 0;
      function sched(){ if(!raf) raf = window.requestAnimationFrame(frame); }

      hero.addEventListener('pointermove', function(e){
        if(e.pointerType === 'touch') return;
        var r = stage.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
        var ny = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
        nx = nx < -1.6 ? -1.6 : nx > 1.6 ? 1.6 : nx;
        ny = ny < -1.6 ? -1.6 : ny > 1.6 ? 1.6 : ny;
        trx = -ny * 6; tryy = nx * 10; tsx = nx * 22;
        tsop = (Math.abs(nx) < 1.2 && Math.abs(ny) < 1.2) ? 0.8 : 0;
        sched();
      }, {passive:true});

      hero.addEventListener('pointerleave', function(){
        trx = 0; tryy = 0; tsop = 0; tsx = 0; sched();
      });

      function frame(){
        raf = 0;
        rx += (trx - rx) * 0.12;
        ry += (tryy - ry) * 0.12;
        sop += (tsop - sop) * 0.12;
        sx += (tsx - sx) * 0.12;
        tilt.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        if(shine){
          shine.style.opacity = sop.toFixed(3);
          shine.style.transform = 'translateX(calc(-50% + ' + sx.toFixed(1) + '%))';
        }
        if(Math.abs(trx - rx) > 0.01 || Math.abs(tryy - ry) > 0.01 ||
           Math.abs(tsop - sop) > 0.01 || Math.abs(tsx - sx) > 0.1){
          sched();
        } else if(Math.abs(rx) < 0.04 && Math.abs(ry) < 0.04){
          tilt.style.transform = '';
        }
      }
    }
  }
})();
