/**
 * Motor de catálogo compartilhado por home, produtos.html (listagem/busca/
 * filtros) e produto.html. Lê window.VERITE_PRODUCTS, populado por
 * assets/js/products-loader.js a partir de /api/public/products.
 */
(function(){
  'use strict';

  var CATEGORIES = [
    { slug: 'perfumes', label: 'Perfumaria' },
    { slug: 'oleos-corporais', label: 'Óleos Corporais' },
    { slug: 'kits', label: 'Kits' },
    { slug: 'presentes', label: 'Presentes' },
    { slug: 'novidades', label: 'Novidades' }
  ];
  var GENDERS = [
    { slug: 'feminino', label: 'Feminino' },
    { slug: 'masculino', label: 'Masculino' },
    { slug: 'unissex', label: 'Unissex' }
  ];
  var SORTS = [
    { slug: 'relevancia', label: 'Relevância' },
    { slug: 'mais-vendidos', label: 'Mais vendidos' },
    { slug: 'menor-preco', label: 'Menor preço' },
    { slug: 'maior-preco', label: 'Maior preço' },
    { slug: 'novidades', label: 'Novidades' }
  ];

  function all(){ return window.VERITE_PRODUCTS || []; }
  function published(){ return all(); } // API já só entrega status=published
  function byCategory(categoryId){ return all().filter(function(p){ return p.category === categoryId; }); }
  function find(slug){ return all().filter(function(p){ return p.id === slug || p.slug === slug; })[0]; }

  function effectivePrice(p){ return p.salePrice != null ? p.salePrice : p.price; }

  function related(product, max){
    if(!product) return [];
    if(product.relatedIds && product.relatedIds.length){
      return product.relatedIds.map(find).filter(Boolean).slice(0, max || 4);
    }
    // sem relatedIds explícito: sugere pela mesma família olfativa, senão pela mesma categoria
    var pool = all().filter(function(p){ return p.slug !== product.slug; });
    if(product.olfactoryFamily){
      var sameFamily = pool.filter(function(p){ return p.olfactoryFamily === product.olfactoryFamily; });
      if(sameFamily.length) return sameFamily.slice(0, max || 4);
    }
    return pool.filter(function(p){ return p.category === product.category; }).slice(0, max || 4);
  }

  function money(value, currency){
    if(typeof value !== 'number') return '';
    try {
      return new Intl.NumberFormat('pt-BR', {style:'currency', currency: currency || 'BRL'}).format(value);
    } catch(e){
      return value.toString();
    }
  }

  function el(tag, className, text){
    var node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  }

  function cartPayload(p){
    return JSON.stringify({
      slug: p.slug || p.id, name: p.name, price: p.price, salePrice: p.salePrice,
      volume: p.volume, images: p.images
    });
  }

  /**
   * Card premium: imagem, badges, nome, categoria, volume, preço (com
   * riscado se houver oferta), favoritar, adicionar ao carrinho, ver perfume.
   */
  function renderProductCard(p){
    var card = el('div', 'product-tile');

    var link = el('a', 'product-tile-link');
    link.href = 'produto.html?slug=' + encodeURIComponent(p.id || p.slug);

    var media = el('div', 'product-tile-media');
    if(p.images && p.images[0]){
      var img = document.createElement('img');
      img.src = p.images[0];
      img.alt = p.name || '';
      img.loading = 'lazy';
      media.appendChild(img);
    }

    var badges = el('div', 'product-tile-badges');
    if(p.bestseller) badges.appendChild(el('span', 'badge badge-bestseller', 'Mais vendido'));
    if(p.isNew) badges.appendChild(el('span', 'badge badge-new', 'Novo'));
    if(p.clubExclusive) badges.appendChild(el('span', 'badge badge-exclusive', 'Exclusivo'));
    if(p.limitedEdition) badges.appendChild(el('span', 'badge badge-limited', 'Edição limitada'));
    if(p.salePrice != null && p.price != null && p.salePrice < p.price) badges.appendChild(el('span', 'badge badge-sale', 'Oferta'));
    if(badges.children.length) media.appendChild(badges);

    var favBtn = el('button', 'product-tile-fav');
    favBtn.type = 'button';
    favBtn.setAttribute('data-fav-toggle', p.id || p.slug);
    favBtn.setAttribute('aria-label', 'Favoritar ' + (p.name || 'produto'));
    favBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-10.2-9.3C.3 8.7 1.6 5 5.1 4.1c2-.5 4 .3 5.1 2 .9-1.7 3-2.5 5-2 3.5.9 4.8 4.6 3.3 7.6C19.5 16.4 12 21 12 21Z"/></svg>';
    media.appendChild(favBtn);

    link.appendChild(media);

    var body = el('div', 'product-tile-body');
    if(p.category){
      var catLabel = (CATEGORIES.filter(function(c){ return c.slug === p.category; })[0] || {}).label || p.category;
      body.appendChild(el('p', 'product-tile-category', catLabel));
    }
    body.appendChild(el('h3', null, p.name || ''));
    if(p.volume) body.appendChild(el('p', 'product-tile-volume', p.volume));

    var priceWrap = el('p', 'product-tile-price');
    if(p.salePrice != null && p.price != null && p.salePrice < p.price){
      var was = el('s', 'product-tile-price-was', money(p.price, p.currency));
      priceWrap.appendChild(was);
      priceWrap.appendChild(document.createTextNode(' ' + money(p.salePrice, p.currency)));
    } else if(p.price != null){
      priceWrap.textContent = money(p.price, p.currency);
    } else {
      priceWrap.textContent = 'Sob consulta';
    }
    body.appendChild(priceWrap);
    link.appendChild(body);
    card.appendChild(link);

    var actions = el('div', 'product-tile-actions');
    if(p.price != null && p.inStock !== false){
      var addBtn = el('button', 'btn btn-ghost product-tile-add', 'Adicionar ao carrinho');
      addBtn.type = 'button';
      addBtn.setAttribute('data-add-to-cart', cartPayload(p));
      actions.appendChild(addBtn);
    } else if(p.inStock === false){
      actions.appendChild(el('p', 'product-tile-oos', 'Esgotado'));
    }
    var viewLink = el('a', 'product-tile-view', 'Ver perfume');
    viewLink.href = link.href;
    actions.appendChild(viewLink);
    card.appendChild(actions);

    return card;
  }

  function renderGrid(container, products){
    if(!container) return;
    container.innerHTML = '';
    products.forEach(function(p){ container.appendChild(renderProductCard(p)); });
    if(window.VeriteFavorites) window.VeriteFavorites.bind(container);
    if(window.VeriteCart) window.VeriteCart.bind(container);
    if(window.VeriteBindReveal) window.VeriteBindReveal(container);
  }

  /**
   * Renderiza qualquer [data-category] com [data-role="grid"]/[data-role="empty"]
   * (ainda usado pela pré-visualização "Primeira Coleção" da home).
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
      if(gridEl){ gridEl.hidden = false; renderGrid(gridEl, items); }
    });
  }

  /**
   * Renderiza qualquer [data-showcase] da home: destaques, mais vendidos,
   * lançamentos — cada um com um filtro simples e um limite de itens.
   * Mostra o empty state elegante já usado no site quando não há produtos.
   */
  function initShowcases(){
    document.querySelectorAll('[data-showcase]').forEach(function(section){
      var kind = section.getAttribute('data-showcase');
      var limit = Number(section.getAttribute('data-limit')) || 8;
      var pool = published();
      var items;
      if(kind === 'featured') items = pool.filter(function(p){ return p.featured; });
      else if(kind === 'bestsellers') items = pool.filter(function(p){ return p.bestseller; });
      else if(kind === 'new') items = pool.filter(function(p){ return p.isNew; });
      else if(kind === 'gifts') items = pool.filter(function(p){ return p.category === 'presentes' || p.category === 'kits'; });
      else items = pool;
      items = items.slice(0, limit);

      var gridEl = section.querySelector('[data-role="grid"]');
      var emptyEl = section.querySelector('[data-role="empty"]');
      if(!items.length){
        if(gridEl) gridEl.hidden = true;
        if(emptyEl) emptyEl.hidden = false;
        return;
      }
      if(emptyEl) emptyEl.hidden = true;
      if(gridEl){ gridEl.hidden = false; renderGrid(gridEl, items); }
    });
  }

  /* ---------- Listagem (produtos.html): filtros + busca + ordenação ---------- */

  function normalize(str){
    return String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function matchesQuery(p, q){
    if(!q) return true;
    var n = normalize(q);
    return normalize(p.name).indexOf(n) !== -1 ||
      normalize(p.category).indexOf(n) !== -1 ||
      normalize(p.olfactoryFamily).indexOf(n) !== -1 ||
      normalize(p.notesTop).indexOf(n) !== -1 ||
      normalize(p.notesHeart).indexOf(n) !== -1 ||
      normalize(p.notesBase).indexOf(n) !== -1 ||
      normalize(p.shortDescription).indexOf(n) !== -1;
  }

  function readFilters(){
    var params = new URLSearchParams(window.location.search);
    return {
      categoria: params.get('categoria') || '',
      genero: params.get('genero') || '',
      colecao: params.get('colecao') || '',
      busca: params.get('busca') || '',
      familia: params.get('familia') || '',
      volume: params.get('volume') || '',
      precoMin: params.get('precoMin') || '',
      precoMax: params.get('precoMax') || '',
      ordenar: params.get('ordenar') || 'relevancia'
    };
  }

  function applyFilters(products, f){
    return products.filter(function(p){
      if(f.categoria && p.category !== f.categoria) return false;
      if(f.genero && p.gender !== f.genero) return false;
      if(f.colecao === 'lancamentos' && !p.isNew) return false;
      if(f.colecao === 'mais-vendidos' && !p.bestseller) return false;
      if(f.colecao === 'ofertas' && !(p.salePrice != null && p.price != null && p.salePrice < p.price)) return false;
      if(f.colecao === 'exclusivos' && !p.clubExclusive) return false;
      if(f.familia && normalize(p.olfactoryFamily) !== normalize(f.familia)) return false;
      if(f.volume && p.volume !== f.volume) return false;
      if(f.precoMin && effectivePrice(p) != null && effectivePrice(p) < Number(f.precoMin)) return false;
      if(f.precoMax && effectivePrice(p) != null && effectivePrice(p) > Number(f.precoMax)) return false;
      if(f.busca && !matchesQuery(p, f.busca)) return false;
      return true;
    });
  }

  function applySort(products, sort){
    var list = products.slice();
    if(sort === 'menor-preco') list.sort(function(a,b){ return (effectivePrice(a) || 0) - (effectivePrice(b) || 0); });
    else if(sort === 'maior-preco') list.sort(function(a,b){ return (effectivePrice(b) || 0) - (effectivePrice(a) || 0); });
    else if(sort === 'novidades') list.sort(function(a,b){ return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
    else if(sort === 'mais-vendidos') list.sort(function(a,b){ return (b.bestseller?1:0) - (a.bestseller?1:0); });
    return list;
  }

  window.VeriteProducts = {
    CATEGORIES: CATEGORIES,
    GENDERS: GENDERS,
    SORTS: SORTS,
    all: all,
    byCategory: byCategory,
    find: find,
    related: related,
    money: money,
    effectivePrice: effectivePrice,
    renderCard: renderProductCard,
    renderGrid: renderGrid,
    initCategoryGrids: initCategoryGrids,
    initShowcases: initShowcases,
    readFilters: readFilters,
    applyFilters: applyFilters,
    applySort: applySort,
    normalize: normalize
  };

  // Não roda sozinho no DOMContentLoaded: assets/js/products-loader.js chama
  // initCategoryGrids()/initShowcases() (ou a listagem própria de produtos.html)
  // assim que window.VERITE_PRODUCTS chega da API.
})();
