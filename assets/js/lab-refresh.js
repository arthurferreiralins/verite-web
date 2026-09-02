/**
 * lab-refresh.js — só é carregado por index-lab.html.
 * Micro-interações novas que complementam (sem substituir) hero-banner.js,
 * scroll-fx.js, pointer.js e main.js: nada aqui repete o que já existe.
 */
(function(){
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fineHover = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* 7) Animações — atração magnética sutil nos botões principais do herói
     e das seções (hb-cta, .btn). O botão se desloca um pouco na direção
     do cursor enquanto ele está por perto, e volta ao centro ao sair. */
  if(!reduceMotion && fineHover){
    var magnets = document.querySelectorAll('.hb-cta, .hero-cta .btn, #clube-home .btn');
    magnets.forEach(function(el){
      el.classList.add('is-magnetic');
      var strength = 14;
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var mx = ((e.clientX - r.left) / r.width - .5) * strength;
        var my = ((e.clientY - r.top) / r.height - .5) * strength;
        el.style.setProperty('--mx', mx.toFixed(1) + 'px');
        el.style.setProperty('--my', my.toFixed(1) + 'px');
      });
      el.addEventListener('mouseleave', function(){
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }

  /* 10) Mobile — véu escuro atrás do menu principal quando aberto, que
     fecha o menu ao ser tocado (hoje só fechava clicando num link). */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if(toggle && nav){
    var backdrop = document.createElement('div');
    backdrop.className = 'lab-nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    function sync(){
      backdrop.classList.toggle('is-visible', nav.classList.contains('is-open'));
    }
    var mo = new MutationObserver(sync);
    mo.observe(nav, {attributes:true, attributeFilter:['class']});
    backdrop.addEventListener('click', function(){
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }
})();
