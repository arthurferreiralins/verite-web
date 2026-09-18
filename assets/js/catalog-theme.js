(function () {
  'use strict';
  var STORAGE_KEY = 'verite-catalog-theme';
  var root = document.documentElement;
  var btn = document.getElementById('catalog-theme-toggle');
  if (!btn) return;

  var label = btn.querySelector('.catalog-theme-toggle-label');

  function sync() {
    var isLight = root.getAttribute('data-theme') === 'light';
    btn.setAttribute('aria-pressed', String(isLight));
    if (label) label.textContent = isLight ? 'Modo escuro' : 'Modo claro';
  }

  btn.addEventListener('click', function () {
    var isLight = root.getAttribute('data-theme') === 'light';
    if (isLight) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', 'light');
    }
    try { localStorage.setItem(STORAGE_KEY, isLight ? '' : 'light'); } catch (e) {}
    sync();
  });

  sync();
})();
