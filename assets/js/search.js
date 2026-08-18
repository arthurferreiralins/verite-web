/**
 * Busca com sugestões ao digitar, em qualquer página com `.header-search`.
 * Reaproveita o catálogo já carregado por products-loader.js
 * (window.VERITE_PRODUCTS) — sem endpoint novo. O <form> continua
 * funcionando normalmente (Enter/clique na lupa vai pra produtos.html?busca=),
 * a caixa de sugestões é só uma camada extra por cima.
 */
(function () {
  'use strict';

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function matchesProduct(p, needle, normalize) {
    var haystack = [p.name, p.category, p.gender, p.olfactoryFamily].join(' ');
    return normalize(haystack).indexOf(needle) !== -1;
  }

  function init(form) {
    var input = form.querySelector('input[name="busca"]');
    if (!input) return;

    var wrap = document.createElement('div');
    wrap.className = 'search-suggestions';
    wrap.hidden = true;
    form.appendChild(wrap);

    function close() {
      wrap.hidden = true;
      wrap.innerHTML = '';
    }

    function render(query) {
      var VP = window.VeriteProducts;
      var catalog = (window.VERITE_PRODUCTS || []);
      if (!VP || !query || !catalog.length) { close(); return; }

      var needle = VP.normalize(query);
      var matches = catalog.filter(function (p) { return matchesProduct(p, needle, VP.normalize); }).slice(0, 6);

      if (!matches.length) { close(); return; }

      wrap.innerHTML = '';
      matches.forEach(function (p) {
        var a = document.createElement('a');
        a.className = 'search-suggestion';
        a.href = 'produto.html?slug=' + encodeURIComponent(p.slug || p.id);
        var priceText = VP.money(p.salePrice != null ? p.salePrice : p.price, p.currency);
        a.innerHTML =
          (p.images && p.images[0] ? '<img src="' + p.images[0] + '" alt="" loading="lazy"/>' : '<span class="search-suggestion-noimg" aria-hidden="true"></span>') +
          '<span class="search-suggestion-info"><strong></strong><span class="search-suggestion-price"></span></span>';
        a.querySelector('strong').textContent = p.name || '';
        a.querySelector('.search-suggestion-price').textContent = priceText;
        wrap.appendChild(a);
      });
      wrap.hidden = false;
    }

    var onInput = debounce(function () { render(input.value.trim()); }, 150);
    input.addEventListener('input', onInput);
    input.addEventListener('focus', function () { if (input.value.trim()) render(input.value.trim()); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('click', function (e) {
      if (!wrap.hidden && !form.contains(e.target)) close();
    });
    form.addEventListener('submit', close);
  }

  function bootstrap() {
    document.querySelectorAll('.header-search').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // window.VERITE_PRODUCTS só chega depois do fetch em products-loader.js —
  // reforça a lista de sugestões (se o campo já tiver texto) assim que o
  // catálogo terminar de carregar.
  window.addEventListener('verite:products-loaded', function () {
    document.querySelectorAll('.header-search input[name="busca"]').forEach(function (input) {
      if (document.activeElement === input && input.value.trim()) {
        input.dispatchEvent(new Event('input'));
      }
    });
  });
})();
