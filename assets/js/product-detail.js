/**
 * produto.html logic — reads ?slug= from the URL, looks it up in
 * window.VERITE_PRODUCTS via VeriteProducts.find(), and fills in the
 * page. With an empty catalog this always falls through to the
 * "not found yet" state, which is expected until real products exist.
 *
 * Not auto-run on DOMContentLoaded: assets/js/products-loader.js fetches
 * window.VERITE_PRODUCTS from the admin-managed catalog first, then calls
 * init() once that data has arrived.
 */
(function(){
  'use strict';

  function init(){
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');
    var product = slug && window.VeriteProducts ? window.VeriteProducts.find(slug) : null;

    var emptyEl = document.getElementById('product-not-found');
    var contentEl = document.getElementById('product-content');

    if(!product){
      if(emptyEl) emptyEl.hidden = false;
      if(contentEl) contentEl.hidden = true;
      return;
    }
    if(emptyEl) emptyEl.hidden = true;
    if(contentEl) contentEl.hidden = false;

    document.title = product.name + ' — VERITÉ';

    var categoryLabel = (window.VeriteProducts.CATEGORIES.filter(function(c){ return c.id === product.category; })[0] || {}).label || '';
    setText('product-category', categoryLabel);
    setText('product-name', product.name);
    setText('product-volume', product.volume || '');
    setText('product-price', window.VeriteProducts.money(product.price, product.currency));
    setText('product-description', product.description || product.shortDescription || '');

    var gallery = document.getElementById('product-gallery');
    if(gallery && product.images && product.images.length){
      gallery.innerHTML = '';
      product.images.forEach(function(src){
        var img = document.createElement('img');
        img.src = src;
        img.alt = product.name;
        gallery.appendChild(img);
      });
    }

    var buyBtn = document.getElementById('product-buy');
    if(buyBtn){
      if(product.buyUrl){
        buyBtn.href = product.buyUrl;
        buyBtn.hidden = false;
      } else {
        buyBtn.hidden = true;
      }
    }

    var relatedWrap = document.getElementById('product-related');
    var relatedGrid = document.getElementById('related-grid');
    var relatedItems = window.VeriteProducts.related(product, 4);
    if(relatedWrap && relatedGrid){
      if(!relatedItems.length){
        relatedWrap.hidden = true;
      } else {
        relatedWrap.hidden = false;
        relatedGrid.innerHTML = '';
        relatedItems.forEach(function(p){ relatedGrid.appendChild(window.VeriteProducts.renderCard(p)); });
      }
    }
  }

  function setText(id, text){
    var elNode = document.getElementById(id);
    if(elNode) elNode.textContent = text || '';
  }

  window.VeriteProductDetail = { init: init };
})();
