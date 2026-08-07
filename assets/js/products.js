/**
 * Shared catalog logic for produtos.html and produto.html.
 * Reads window.VERITE_PRODUCTS (assets/js/products-data.js) — currently
 * empty, so every function below degrades to its "no products yet" state.
 */
(function(){
  'use strict';

  var CATEGORIES = [
    { id: 'perfumes', label: 'Perfumes' },
    { id: 'oleos-corporais', label: 'Óleos Corporais' },
    { id: 'kits', label: 'Kits' },
    { id: 'novidades', label: 'Novidades' }
  ];

  function all(){
    return window.VERITE_PRODUCTS || [];
  }

  function byCategory(categoryId){
    return all().filter(function(p){ return p.category === categoryId; });
  }

  function find(slug){
    return all().filter(function(p){ return p.id === slug; })[0];
  }

  function related(product, max){
    if(!product || !product.relatedIds) return [];
    return product.relatedIds
      .map(find)
      .filter(Boolean)
      .slice(0, max || 4);
  }

  function money(value, currency){
    if(typeof value !== 'number') return '';
    try {
      return new Intl.NumberFormat('pt-BR', {style:'currency', currency: currency || 'BRL'}).format(value);
    } catch(e){
      return value.toString();
    }
  }

  function el(tag, className, html){
    var node = document.createElement(tag);
    if(className) node.className = className;
    if(html != null) node.innerHTML = html;
    return node;
  }

  function renderProductCard(p){
    var card = el('a', 'product-tile');
    card.href = 'produto.html?slug=' + encodeURIComponent(p.id);

    var media = el('div', 'product-tile-media');
    if(p.images && p.images[0]){
      var img = document.createElement('img');
      img.src = p.images[0];
      img.alt = p.name || '';
      img.loading = 'lazy';
      media.appendChild(img);
    }
    card.appendChild(media);
    card.appendChild(el('h3', null, p.name || ''));
    if(p.volume) card.appendChild(el('p', 'product-tile-volume', p.volume));
    var priceText = money(p.price, p.currency);
    if(priceText) card.appendChild(el('p', 'product-tile-price', priceText));
    return card;
  }

  /**
   * Renders every [data-category] block found on the page: fills its
   * [data-role="grid"] with product-tile cards when that category has
   * products, otherwise leaves the [data-role="empty"] "Em breve." panel
   * visible. Safe to call on pages with no such blocks (no-op).
   */
  function initCategoryGrids(){
    document.querySelectorAll('[data-category]').forEach(function(section){
      var categoryId = section.getAttribute('data-category');
      var gridEl = section.querySelector('[data-role="grid"]');
      var emptyEl = section.querySelector('[data-role="empty"]');
      var items = byCategory(categoryId);

      if(!items.length){
        if(gridEl) gridEl.hidden = true;
        if(emptyEl) emptyEl.hidden = false;
        return;
      }
      if(emptyEl) emptyEl.hidden = true;
      if(gridEl){
        gridEl.hidden = false;
        gridEl.innerHTML = '';
        items.forEach(function(p){ gridEl.appendChild(renderProductCard(p)); });
      }
    });
  }

  window.VeriteProducts = {
    CATEGORIES: CATEGORIES,
    all: all,
    byCategory: byCategory,
    find: find,
    related: related,
    money: money,
    renderCard: renderProductCard,
    initCategoryGrids: initCategoryGrids
  };

  document.addEventListener('DOMContentLoaded', initCategoryGrids);
})();
