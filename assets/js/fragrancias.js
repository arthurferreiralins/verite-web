/**
 * 2ª seção (#fragrancias) — "Descubra Nossas Fragrâncias".
 *
 * A revelação progressiva no scroll e o hover (elevação / brilho dourado /
 * sheen) são CSS + o IntersectionObserver global de .reveal (main.js).
 * Aqui fica só a profundidade sutil no mouse: um tilt 3D discreto por
 * card, com lerp. Desliga em toque e em prefers-reduced-motion.
 */
(function(){
  'use strict';

  var sec = document.getElementById('fragrancias');
  if(!sec) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine   = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(reduce || !fine) return;

  var cards = Array.prototype.slice.call(sec.querySelectorAll('.category-card'));
  if(!cards.length) return;

  cards.forEach(function(card){
    var rx = 0, ry = 0, h = 0;          /* rotX / rotY / "quanto está sob o mouse" atuais */
    var trx = 0, tryy = 0, th = 0;      /* alvos */
    var raf = 0;

    function schedule(){ if(!raf) raf = window.requestAnimationFrame(frame); }

    function frame(){
      raf = 0;
      rx += (trx  - rx) * 0.16;
      ry += (tryy - ry) * 0.16;
      h  += (th   - h)  * 0.16;

      var lift = (-8 * h).toFixed(2);
      var sc   = (1 + 0.012 * h).toFixed(4);
      card.style.transform =
        'translateY(' + lift + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' +
        ry.toFixed(2) + 'deg) scale(' + sc + ')';

      if(Math.abs(trx - rx) > 0.01 || Math.abs(tryy - ry) > 0.01 || Math.abs(th - h) > 0.01){
        schedule();
      } else if(th === 0 && h < 0.01){
        /* soltou: devolve o controle pro CSS sem salto */
        card.style.transform = '';
        card.style.transition = '';
      }
    }

    card.addEventListener('pointerenter', function(e){
      if(e.pointerType === 'touch') return;
      th = 1;
      card.style.transition = 'none';   /* o rAF já suaviza; evita briga com a transição CSS */
      schedule();
    });

    card.addEventListener('pointermove', function(e){
      if(e.pointerType === 'touch') return;
      var r = card.getBoundingClientRect();
      var nx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
      var ny = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
      nx = nx < -1 ? -1 : nx > 1 ? 1 : nx;
      ny = ny < -1 ? -1 : ny > 1 ? 1 : ny;
      trx = -ny * 3.5;
      tryy = nx * 3.5;
      schedule();
    }, {passive:true});

    card.addEventListener('pointerleave', function(){
      th = 0; trx = 0; tryy = 0;
      schedule();
    });
  });
})();
