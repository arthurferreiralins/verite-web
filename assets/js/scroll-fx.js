/**
 * scroll-fx — camada leve de animação no scroll, sem bibliotecas.
 *
 *  - Barra de progresso dourada no topo da página.
 *  - Elementos [data-scrollfx] recebem a variável --p (0 → 1) conforme
 *    cruzam a tela; o CSS decide o efeito (escala, opacidade, deslize).
 *
 * Um único requestAnimationFrame, listeners passivos. Desliga inteiro
 * em prefers-reduced-motion (a barra some, o --p fica em 1 = repouso).
 */
(function(){
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  (document.body || document.documentElement).appendChild(bar);

  var fxEls = reduce ? [] : Array.prototype.slice.call(document.querySelectorAll('[data-scrollfx]'));
  var ticking = false;

  function update(){
    ticking = false;
    var doc = document.documentElement;
    var max = (doc.scrollHeight - doc.clientHeight) || 1;
    var progress = window.scrollY / max;
    progress = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    bar.style.transform = 'scaleX(' + progress.toFixed(4) + ')';

    if(fxEls.length){
      var vh = window.innerHeight || doc.clientHeight;
      for(var i = 0; i < fxEls.length; i++){
        var el = fxEls[i];
        var r = el.getBoundingClientRect();
        /* p = 0 quando o topo do elemento ainda está bem abaixo;
           p = 1 quando o topo passou de ~40% da altura da tela */
        var p = 1 - (r.top - vh * 0.4) / (vh * 0.72);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        el.style.setProperty('--p', p.toFixed(3));
      }
    }
  }

  function onScroll(){
    if(!ticking){ ticking = true; window.requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
  update();
})();
