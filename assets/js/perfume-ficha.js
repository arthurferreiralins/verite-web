/**
 * Ficha "em breve" de um perfume (perfume-*.html).
 *
 * O formulário "Avise-me quando chegar" NÃO precisa de JS próprio: o motor
 * genérico de assets/js/main.js já valida e envia qualquer
 * form[data-submit-endpoint] para /api/public/waitlist, e o campo oculto
 * `perfume` (nome do perfume) segue no payload junto com nome e e-mail.
 *
 * Este arquivo só cuida da virada: quando o painel publicar um produto que
 * corresponda a este perfume (aparece em /api/public/products), o selo "Em
 * breve" e o formulário dão lugar a um botão para o produto de verdade.
 */
(function () {
  'use strict';

  var secao = document.querySelector('[data-perfume-slug]');
  if (!secao) return;

  function virar() {
    var VP = window.VeritePerfumes;
    if (!VP) return;
    var perfume = VP.porSlug(secao.getAttribute('data-perfume-slug'));
    if (!perfume) return;
    var real = VP.produtoReal(perfume);
    if (!real) return; /* segue "em breve" */

    var selo = secao.querySelector('[data-selo]');
    var form = secao.querySelector('[data-avise]');
    var disp = secao.querySelector('[data-disponivel]');
    var link = secao.querySelector('[data-disponivel-link]');
    if (selo) { selo.classList.add('is-on'); selo.lastChild.textContent = 'Disponível'; }
    if (form) form.hidden = true;
    if (link) link.setAttribute('href', 'produto.html?slug=' + encodeURIComponent(real.slug || real.id));
    if (disp) disp.hidden = false;
  }

  window.addEventListener('verite:products-loaded', virar);
})();
