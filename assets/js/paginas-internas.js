/**
 * Revelação suave ao entrar na tela, nas páginas internas (produtos, produto,
 * sobre e as fichas dos perfumes).
 *
 * É a mesma classe `.rv` / `.rv.in` que a home usa (definida em
 * assets/css/home-nova.css); na home quem a aciona é assets/js/home-nova.js,
 * que só roda lá. Aqui é a versão mínima para as demais páginas: um único
 * IntersectionObserver. Sem IntersectionObserver ou com movimento reduzido
 * tudo aparece de uma vez — o conteúdo nunca depende da animação.
 */
(function () {
  'use strict';

  var itens = Array.prototype.slice.call(document.querySelectorAll('.rv'));
  if (!itens.length) return;

  var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduz || !('IntersectionObserver' in window)) {
    itens.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  itens.forEach(function (el) { obs.observe(el); });
})();
