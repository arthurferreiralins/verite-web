/**
 * favoritos.html: cruza os slugs favoritados (locais ou da conta do Clube,
 * via VeriteFavorites) com o catálogo já carregado (VERITE_PRODUCTS) e
 * renderiza os cards — sem tabela/endpoint novo.
 */
(function(){
  'use strict';

  function init(){
    var grid = document.getElementById('favorites-grid');
    var empty = document.getElementById('favorites-empty');
    var skeleton = document.getElementById('favorites-skeleton');
    if(!grid || !window.VeriteFavorites || !window.VeriteProducts) return;

    window.VeriteFavorites.listSlugs().then(function(slugs){
      if(skeleton) skeleton.hidden = true;
      var items = window.VeriteProducts.all().filter(function(p){
        return slugs.indexOf(p.slug || p.id) !== -1;
      });
      if(!items.length){
        grid.hidden = true;
        if(empty) empty.hidden = false;
        return;
      }
      if(empty) empty.hidden = true;
      grid.hidden = false;
      window.VeriteProducts.renderGrid(grid, items);
    });
  }

  window.VeriteFavoritesPage = { init: init };
})();
