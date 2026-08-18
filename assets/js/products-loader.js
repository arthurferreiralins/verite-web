/**
 * Shared across index.html / produtos.html / produto.html: fetches published
 * products from the admin-managed catalog and feeds the existing render
 * logic in products.js / product-detail.js (unchanged) instead of the old
 * static assets/js/products-data.js file. On any failure it falls back to
 * an empty catalog — the exact "Em breve." state the site already shows
 * today, so nothing breaks if the API is unreachable.
 */
(function(){
  'use strict';

  function renderCollectionPreview(products){
    var grid = document.querySelector('.colecao-grid');
    if(!grid) return;
    var featured = products.slice(0, 3);
    if(!featured.length) return; // keep the existing "Em breve" mystery cards

    var connector = grid.querySelector('.colecao-connector');
    while(grid.firstChild) grid.removeChild(grid.firstChild);
    if(connector) grid.appendChild(connector);

    featured.forEach(function(p){
      var a = document.createElement('a');
      a.className = 'produto-card produto-card-real reveal';
      a.href = 'produto.html?slug=' + encodeURIComponent(p.id);
      if(p.images && p.images[0]){
        var img = document.createElement('img');
        img.src = p.images[0];
        img.alt = p.name || '';
        img.loading = 'lazy';
        img.className = 'produto-card-img';
        a.appendChild(img);
      }
      var name = document.createElement('span');
      name.className = 'produto-tag';
      name.textContent = p.name || '';
      a.appendChild(name);
      grid.appendChild(a);
    });
    if(window.VeriteBindReveal) window.VeriteBindReveal(grid);
  }

  function afterLoad(products){
    window.VERITE_PRODUCTS = products;
    if(window.VeriteProducts && typeof window.VeriteProducts.initCategoryGrids === 'function'){
      window.VeriteProducts.initCategoryGrids();
    }
    if(window.VeriteProducts && typeof window.VeriteProducts.initShowcases === 'function'){
      window.VeriteProducts.initShowcases();
    }
    if(window.VeriteInitListing) window.VeriteInitListing();
    if(window.VeriteProductDetail && typeof window.VeriteProductDetail.init === 'function'){
      window.VeriteProductDetail.init();
    }
    if(window.VeriteQuiz && typeof window.VeriteQuiz.init === 'function'){
      window.VeriteQuiz.init();
    }
    if(window.VeriteFavoritesPage && typeof window.VeriteFavoritesPage.init === 'function'){
      window.VeriteFavoritesPage.init();
    }
    renderCollectionPreview(products);
  }

  fetch('/api/public/products')
    .then(function(res){ return res.ok ? res.json() : { products: [] }; })
    .then(function(data){ afterLoad((data && data.products) || []); })
    .catch(function(){ afterLoad([]); });
})();
