/**
 * 2ª seção — "NOSSAS FRAGRÂNCIAS" (vitrine).
 *
 * - Filtro minimalista: troca suave dos cards com FLIP (mede antes/depois,
 *   inverte e toca) — sem salto de página. Dourado indica a categoria ativa.
 * - Profundidade sutil no mouse: tilt 3D discreto por card, com lerp.
 *
 * O revelar encadeado (título → descrição → cards) e o hover premium são
 * CSS + o IntersectionObserver global de .reveal (main.js). Tudo desliga
 * em toque / prefers-reduced-motion.
 */
(function(){
  'use strict';

  var sec = document.getElementById('fragrancias');
  if(!sec) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine   = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var grid  = sec.querySelector('.frag-grid');
  var cards = Array.prototype.slice.call(sec.querySelectorAll('.frag-card'));
  var btns  = Array.prototype.slice.call(sec.querySelectorAll('.frag-filter'));

  /* --------------------------------------------------------------------
     Filtro — troca suave (FLIP)
     -------------------------------------------------------------------- */
  if(grid && cards.length && btns.length){
    var current = 'todos';

    function matches(card, key){
      if(key === 'todos') return true;
      return (' ' + (card.getAttribute('data-filter') || '') + ' ')
        .indexOf(' ' + key + ' ') !== -1;
    }

    function setFilter(key){
      if(key === current) return;
      current = key;

      btns.forEach(function(b){
        var on = b.getAttribute('data-filter') === key;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      if(reduce){
        cards.forEach(function(c){ c.hidden = !matches(c, key); });
        return;
      }

      var first = cards.map(function(c){ return c.getBoundingClientRect(); });
      var wasHidden = cards.map(function(c){ return c.hidden; });

      cards.forEach(function(c){ c.hidden = !matches(c, key); });

      cards.forEach(function(c, i){
        if(c.hidden) return;
        var last = c.getBoundingClientRect();

        if(wasHidden[i]){
          /* estava oculto e agora aparece: fade + subida curta */
          c.style.transition = 'none';
          c.style.opacity = '0';
          c.style.transform = 'translateY(16px)';
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){
              c.style.transition = 'opacity .5s ease, transform .5s cubic-bezier(.2,.7,.2,1)';
              c.style.opacity = '';
              c.style.transform = '';
            });
          });
          return;
        }

        /* continua visível: desliza da posição antiga pra nova (FLIP) */
        var dx = first[i].left - last.left;
        var dy = first[i].top - last.top;
        if(dx || dy){
          c.style.transition = 'none';
          c.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){
              c.style.transition = 'transform .5s cubic-bezier(.2,.7,.2,1)';
              c.style.transform = '';
            });
          });
        }
      });

      window.setTimeout(function(){
        cards.forEach(function(c){
          if(c.hidden) return;
          c.style.transition = '';
          c.style.transform = '';
          c.style.opacity = '';
        });
      }, 620);
    }

    btns.forEach(function(b){
      b.addEventListener('click', function(){ setFilter(b.getAttribute('data-filter')); });
    });
  }

  /* --------------------------------------------------------------------
     Profundidade sutil no mouse — tilt 3D por card (ponteiro fino)
     -------------------------------------------------------------------- */
  if(!reduce && fine && cards.length){
    cards.forEach(function(card){
      var rx = 0, ry = 0, h = 0, trx = 0, tryy = 0, th = 0, raf = 0;

      function schedule(){ if(!raf) raf = window.requestAnimationFrame(frame); }

      function frame(){
        raf = 0;
        rx += (trx  - rx) * 0.16;
        ry += (tryy - ry) * 0.16;
        h  += (th   - h)  * 0.16;
        var lift = (-8 * h).toFixed(2);
        card.style.transform =
          'translateY(' + lift + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        if(Math.abs(trx - rx) > 0.01 || Math.abs(tryy - ry) > 0.01 || Math.abs(th - h) > 0.01){
          schedule();
        } else if(th === 0 && h < 0.01){
          card.style.transform = '';
          card.style.transition = '';
        }
      }

      card.addEventListener('pointerenter', function(e){
        if(e.pointerType === 'touch') return;
        th = 1;
        card.style.transition = 'none';   /* o rAF suaviza; evita briga com a transição CSS */
        schedule();
      });
      card.addEventListener('pointermove', function(e){
        if(e.pointerType === 'touch') return;
        var r = card.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
        var ny = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
        nx = nx < -1 ? -1 : nx > 1 ? 1 : nx;
        ny = ny < -1 ? -1 : ny > 1 ? 1 : ny;
        trx = -ny * 3;
        tryy = nx * 3;
        schedule();
      }, {passive:true});
      card.addEventListener('pointerleave', function(){
        th = 0; trx = 0; tryy = 0;
        schedule();
      });
    });
  }

  /* --------------------------------------------------------------------
     Iluminação da vitrine muda conforme a fragrância sob o cursor:
     cada card leva um matiz dourado próprio; ao passar o mouse, o brilho
     de fundo da seção desliza pra esse tom (transição no CSS).
     -------------------------------------------------------------------- */
  if(!reduce && fine && cards.length){
    var TINTS = {
      feminino:'233,201,160', masculino:'150,172,196', unissex:'206,196,158',
      kits:'214,178,124', presentes:'168,200,176', lancamentos:'194,172,214'
    };
    cards.forEach(function(card){
      var tint = TINTS[card.getAttribute('data-filter')];
      if(!tint) return;
      card.addEventListener('pointerenter', function(e){
        if(e.pointerType === 'touch') return;
        sec.style.setProperty('--tint', tint);
      });
      card.addEventListener('pointerleave', function(){
        sec.style.removeProperty('--tint');
      });
    });
  }
})();
