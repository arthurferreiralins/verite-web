/**
 * Esconde do menu, dos filtros e do rodapé os gêneros que não têm NENHUM
 * produto — e faz isso sozinho, olhando o catálogo.
 *
 * Nasceu porque o Doréa (o único produto unissex) passou a ser feminino:
 * a categoria "Unissex" ficou sem nada para mostrar, e um caminho que só
 * leva a "0 perfumes encontrados" é pior do que caminho nenhum.
 *
 * NADA É APAGADO. Os links, as colunas do mega menu e a opção de filtro
 * continuam no HTML e em VeriteProducts.GENDERS; só ganham `hidden`. No dia
 * em que existir um produto unissex cadastrado, eles reaparecem sozinhos,
 * sem ninguém tocar em código.
 *
 * REGRA IMPORTANTE — catálogo vazio não esconde nada:
 * hoje o catálogo inteiro está vazio (nenhum produto cadastrado no painel).
 * Se a conta fosse só "gênero sem produto", TODOS os gêneros sumiriam e o
 * menu ficaria mutilado. Então só escondemos quando já existe catálogo: com
 * zero produtos, o site mantém a estrutura completa, como hoje.
 */
(function () {
  'use strict';

  var GENEROS = ['feminino', 'masculino', 'unissex'];
  var MARCA = 'data-genero-vazio';

  function catalogo() { return window.VERITE_PRODUCTS || []; }

  function vazios() {
    var todos = catalogo();
    if (!todos.length) return [];           /* pré-lançamento: não esconde nada */
    return GENEROS.filter(function (g) {
      return !todos.some(function (p) { return p && p.gender === g; });
    });
  }

  /* mostra/esconde marcando com um atributo próprio, para nunca brigar com
     um `hidden` que já existia no HTML por outro motivo */
  function definir(el, esconder) {
    if (!el) return;
    if (esconder) {
      if (!el.hasAttribute(MARCA)) { el.setAttribute(MARCA, ''); el.hidden = true; }
    } else if (el.hasAttribute(MARCA)) {
      el.removeAttribute(MARCA); el.hidden = false;
    }
  }

  function aplicar() {
    var some = vazios();

    GENEROS.forEach(function (g) {
      var esconder = some.indexOf(g) !== -1;

      /* 1. qualquer link do menu/rodapé que filtre por este gênero */
      Array.prototype.forEach.call(
        document.querySelectorAll('a[href*="genero=' + g + '"]'),
        function (a) {
          /* num mega-painel o item some junto com a linha inteira */
          definir(a, esconder);
        }
      );

      /* 2. a coluna inteira do mega menu, quando sobrou só o título */
      Array.prototype.forEach.call(document.querySelectorAll('.mega-col'), function (col) {
        var links = col.querySelectorAll('a');
        var visiveis = Array.prototype.filter.call(links, function (a) { return !a.hidden; });
        definir(col, links.length > 0 && visiveis.length === 0);
      });

      /* 3. a opção no filtro do catálogo (o rótulo inteiro, com o input) */
      Array.prototype.forEach.call(
        document.querySelectorAll('#listing-filter-gender input[value="' + g + '"]'),
        function (input) { definir(input.closest('label') || input, esconder); }
      );
    });
  }

  function agendar() { window.requestAnimationFrame(aplicar); }

  window.addEventListener('verite:products-loaded', agendar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agendar);
  else agendar();

  /* o filtro do catálogo é remontado a cada mudança (listing.js); o observer
     reaplica sem precisar que o listing conheça este arquivo */
  var alvo = document.getElementById('listing-filter-gender');
  if (alvo && window.MutationObserver) {
    new window.MutationObserver(agendar).observe(alvo, { childList: true });
  }
})();
