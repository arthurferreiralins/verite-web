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

  function setText(id, text){
    var elNode = document.getElementById(id);
    if(elNode) elNode.textContent = text || '';
  }

  function setRow(id, value){
    var row = document.getElementById(id);
    if(!row) return;
    if(!value){ row.hidden = true; return; }
    row.hidden = false;
    var valueEl = row.querySelector('[data-value]');
    if(valueEl) valueEl.textContent = value;
  }

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

    var VP = window.VeriteProducts;

    document.title = product.seoTitle || (product.name + ' — VERITÉ');
    if(product.seoDescription){
      var metaDesc = document.querySelector('meta[name="description"]');
      if(metaDesc) metaDesc.setAttribute('content', product.seoDescription);
    }

    // Dados estruturados (schema.org/Product) — só quando há produto real.
    var existingLd = document.getElementById('product-jsonld');
    if(existingLd) existingLd.remove();
    var ld = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name,
      description: product.description || product.shortDescription || undefined,
      sku: product.sku || undefined,
      image: (product.images && product.images.length) ? product.images : undefined,
      brand: { '@type': 'Brand', name: 'Verité' },
      offers: product.price != null ? {
        '@type': 'Offer',
        priceCurrency: product.currency || 'BRL',
        price: (product.salePrice != null ? product.salePrice : product.price).toFixed(2),
        availability: product.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: window.location.href
      } : undefined
    };
    var ldScript = document.createElement('script');
    ldScript.type = 'application/ld+json';
    ldScript.id = 'product-jsonld';
    ldScript.textContent = JSON.stringify(ld);
    document.head.appendChild(ldScript);

    var categoryLabel = (VP.CATEGORIES.filter(function(c){ return c.slug === product.category; })[0] || {}).label || '';
    setText('product-category', categoryLabel);
    setText('product-name', product.name);
    setText('product-volume', product.volume || '');
    setText('product-description', product.description || product.shortDescription || '');

    var priceEl = document.getElementById('product-price');
    if(priceEl){
      priceEl.innerHTML = '';
      if(product.salePrice != null && product.price != null && product.salePrice < product.price){
        var was = document.createElement('s');
        was.className = 'product-price-was';
        was.textContent = VP.money(product.price, product.currency);
        priceEl.appendChild(was);
        priceEl.appendChild(document.createTextNode(' ' + VP.money(product.salePrice, product.currency)));
      } else if(product.price != null){
        priceEl.textContent = VP.money(product.price, product.currency);
      } else {
        priceEl.textContent = 'Sob consulta';
      }
    }

    var installmentsEl = document.getElementById('product-installments');
    if(installmentsEl){
      var installmentBase = product.salePrice != null ? product.salePrice : product.price;
      if(installmentBase != null && installmentBase > 0){
        installmentsEl.hidden = false;
        installmentsEl.textContent = 'ou 3x de ' + VP.money(installmentBase / 3, product.currency) + ' sem juros';
      } else {
        installmentsEl.hidden = true;
      }
    }

    var badges = document.getElementById('product-badges');
    if(badges){
      badges.innerHTML = '';
      var badgeDefs = [
        [product.bestseller, 'badge-bestseller', 'Mais vendido'],
        [product.isNew, 'badge-new', 'Novo'],
        [product.clubExclusive, 'badge-exclusive', 'Exclusivo do Clube'],
        [product.limitedEdition, 'badge-limited', 'Edição limitada']
      ];
      badgeDefs.forEach(function(def){
        if(!def[0]) return;
        var span = document.createElement('span');
        span.className = 'badge ' + def[1];
        span.textContent = def[2];
        badges.appendChild(span);
      });
    }

    var stockEl = document.getElementById('product-stock');
    if(stockEl) stockEl.textContent = product.inStock === false ? 'Produto esgotado no momento.' : '';

    /* Galeria: imagem principal grande + miniaturas clicáveis */
    var mainImg = document.getElementById('product-main-image');
    var thumbsWrap = document.getElementById('product-thumbs');
    var images = (product.images && product.images.length) ? product.images : [];
    if(mainImg) mainImg.src = images[0] || '';
    if(mainImg) mainImg.alt = product.name || '';
    if(thumbsWrap){
      thumbsWrap.innerHTML = '';
      if(images.length > 1){
        images.forEach(function(src, i){
          var thumb = document.createElement('button');
          thumb.type = 'button';
          thumb.className = 'product-thumb' + (i === 0 ? ' is-active' : '');
          var img = document.createElement('img');
          img.src = src; img.alt = '';
          thumb.appendChild(img);
          thumb.addEventListener('click', function(){
            if(mainImg) mainImg.src = src;
            thumbsWrap.querySelectorAll('.product-thumb').forEach(function(t){ t.classList.remove('is-active'); });
            thumb.classList.add('is-active');
          });
          thumbsWrap.appendChild(thumb);
        });
      }
    }

    setRow('product-row-family', product.olfactoryFamily);
    setRow('product-row-concentration', product.concentration);
    setRow('product-row-notes-top', product.notesTop);
    setRow('product-row-notes-heart', product.notesHeart);
    setRow('product-row-notes-base', product.notesBase);
    setRow('product-row-occasion', product.occasion);
    setRow('product-row-intensity', product.intensity);

    var qtyInput = document.getElementById('product-qty');
    if(qtyInput) qtyInput.value = 1;

    var addBtn = document.getElementById('product-add-cart');
    if(addBtn){
      if(product.price != null && product.inStock !== false){
        addBtn.hidden = false;
        addBtn.setAttribute('data-add-to-cart', JSON.stringify({
          slug: product.slug || product.id, name: product.name, price: product.price,
          salePrice: product.salePrice, volume: product.volume, images: product.images
        }));
        addBtn.setAttribute('data-qty-input', 'product-qty');
      } else {
        addBtn.hidden = true;
      }
    }

    // "Comprar Agora": adiciona ao carrinho com a quantidade escolhida e vai
    // direto pro carrinho — não é um checkout de verdade (fora de escopo),
    // só um atalho pra quem já sabe que quer aquele perfume.
    var buyNowBtn = document.getElementById('product-buy-now');
    if(buyNowBtn){
      if(product.price != null && product.inStock !== false){
        buyNowBtn.hidden = false;
        if(!buyNowBtn.dataset.bound){
          buyNowBtn.dataset.bound = '1';
          buyNowBtn.addEventListener('click', function(){
            var current = window.VeriteProducts.find(slug);
            var qty = qtyInput ? Number(qtyInput.value) : 1;
            if(window.VeriteCart && current){
              window.VeriteCart.add({
                slug: current.slug || current.id, name: current.name, price: current.price,
                salePrice: current.salePrice, volume: current.volume, images: current.images
              }, qty);
            }
            window.location.href = 'carrinho.html';
          });
        }
      } else {
        buyNowBtn.hidden = true;
      }
    }

    var favBtn = document.getElementById('product-favorite');
    if(favBtn){
      favBtn.hidden = false;
      favBtn.setAttribute('data-fav-toggle', product.slug || product.id);
    }

    var relatedWrap = document.getElementById('product-related');
    var relatedGrid = document.getElementById('related-grid');
    var relatedItems = VP.related(product, 4);
    if(relatedWrap && relatedGrid){
      if(!relatedItems.length){
        relatedWrap.hidden = true;
      } else {
        relatedWrap.hidden = false;
        VP.renderGrid(relatedGrid, relatedItems);
      }
    }

    if(window.VeriteFavorites) window.VeriteFavorites.bind(contentEl);
    if(window.VeriteCart) window.VeriteCart.bind(contentEl);
    if(window.VeriteBindReveal) window.VeriteBindReveal(contentEl);
  }

  window.VeriteProductDetail = { init: init };
})();
