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
    window.dispatchEvent(new Event('verite:products-loaded'));
  }

  fetch('/api/public/products')
    .then(function(res){ return res.ok ? res.json() : { products: [] }; })
    .then(function(data){ afterLoad((data && data.products) || []); })
    .catch(function(){ afterLoad([]); });
})();
