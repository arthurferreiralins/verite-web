/**
 * Carrinho 100% client-side (localStorage) — checkout real fica pra uma
 * próxima etapa (combinado com o usuário). "Finalizar compra" não cria
 * pedido nem cobra: abre um painel honesto que oferece fechar pelo
 * WhatsApp (canal já real do site) com o resumo do carrinho.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'verite_cart';
  var WHATSAPP_NUMBER = '5581981553632';

  function readCart() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(list) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
    render();
  }

  function money(value) {
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
    catch (e) { return 'R$ ' + value.toFixed(2); }
  }

  function add(product, qty) {
    qty = Math.max(1, Math.trunc(qty || 1));
    var list = readCart();
    var price = product.salePrice != null ? product.salePrice : product.price;
    var existing = list.filter(function (i) { return i.slug === product.slug; })[0];
    if (existing) {
      existing.qty += qty;
    } else {
      list.push({
        slug: product.slug,
        name: product.name,
        image: (product.images && product.images[0]) || '',
        volume: product.volume || '',
        price: price != null ? price : 0,
        qty: qty
      });
    }
    writeCart(list);
    if (window.VeriteToast) window.VeriteToast('Adicionado à sua seleção Verité.');
  }

  function setQty(slug, qty) {
    qty = Math.max(1, Math.trunc(qty || 1));
    var list = readCart();
    list.forEach(function (i) { if (i.slug === slug) i.qty = qty; });
    writeCart(list);
  }

  function remove(slug) {
    writeCart(readCart().filter(function (i) { return i.slug !== slug; }));
  }

  function clear() {
    writeCart([]);
  }

  function count() {
    return readCart().reduce(function (n, i) { return n + i.qty; }, 0);
  }

  function subtotal() {
    return readCart().reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
  }

  var appliedCoupon = null; // {code, label, percent}

  function parsePercent(label) {
    var m = String(label || '').match(/(\d+(?:[.,]\d+)?)\s*%/);
    return m ? Number(m[1].replace(',', '.')) : null;
  }

  function applyCoupon(code) {
    return fetch('/api/club/coupons', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('not-club');
        return res.json();
      })
      .then(function (data) {
        var match = (data.items || []).filter(function (c) {
          return c.status === 'ativo' && String(c.code).toUpperCase() === String(code).toUpperCase();
        })[0];
        if (!match) throw new Error('Cupom inválido ou já utilizado.');
        var percent = parsePercent(match.discount_label);
        appliedCoupon = { code: match.code, label: match.discount_label, percent: percent };
        render();
        return appliedCoupon;
      })
      .catch(function (err) {
        if (err.message === 'not-club') {
          throw new Error('Entre no Clube Verité para usar cupons exclusivos.');
        }
        throw err;
      });
  }

  function clearCoupon() {
    appliedCoupon = null;
    render();
  }

  function discountAmount() {
    if (!appliedCoupon || !appliedCoupon.percent) return 0;
    return subtotal() * (appliedCoupon.percent / 100);
  }

  function total() {
    return Math.max(0, subtotal() - discountAmount());
  }

  function whatsappCheckoutUrl() {
    var lines = readCart().map(function (i) {
      return '- ' + i.name + (i.volume ? ' (' + i.volume + ')' : '') + ' x' + i.qty + ' — ' + money(i.price * i.qty);
    });
    var msg = 'Olá! Quero fechar este pedido da VERITÉ:\n\n' + lines.join('\n') +
      '\n\nSubtotal: ' + money(subtotal()) +
      (appliedCoupon ? '\nCupom: ' + appliedCoupon.code : '') +
      '\nTotal estimado: ' + money(total());
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  /* ---------- Render: header badge + mini-cart + full cart page ---------- */

  function renderBadge() {
    var n = count();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
  }

  function renderMiniCart() {
    var wrap = document.getElementById('mini-cart-items');
    if (!wrap) return;
    var list = readCart();
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.innerHTML = '<p class="mini-cart-empty">Seu carrinho está vazio.</p>';
    } else {
      list.slice(0, 4).forEach(function (i) {
        var row = document.createElement('div');
        row.className = 'mini-cart-row';
        row.innerHTML =
          (i.image ? '<img src="' + i.image + '" alt="" loading="lazy"/>' : '<span class="mini-cart-noimg" aria-hidden="true"></span>') +
          '<span class="mini-cart-info"><strong>' + i.name + '</strong><span>' + i.qty + ' × ' + money(i.price) + '</span></span>';
        wrap.appendChild(row);
      });
      if (list.length > 4) {
        var more = document.createElement('p');
        more.className = 'mini-cart-more';
        more.textContent = '+ ' + (list.length - 4) + ' outro(s) item(ns)';
        wrap.appendChild(more);
      }
    }
    var subtotalEl = document.getElementById('mini-cart-subtotal');
    if (subtotalEl) subtotalEl.textContent = money(subtotal());
  }

  function renderCartPage() {
    var tbody = document.getElementById('cart-items');
    if (!tbody) return;
    var list = readCart();
    tbody.innerHTML = '';
    var emptyEl = document.getElementById('cart-empty');
    var tableWrap = document.getElementById('cart-table-wrap');
    if (!list.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (tableWrap) tableWrap.hidden = true;
    } else {
      if (emptyEl) emptyEl.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
      list.forEach(function (i) {
        var row = document.createElement('div');
        row.className = 'cart-row';
        row.innerHTML =
          '<div class="cart-row-product">' +
            (i.image ? '<img src="' + i.image + '" alt="" loading="lazy"/>' : '<span class="cart-row-noimg" aria-hidden="true"></span>') +
            '<div><strong>' + i.name + '</strong>' + (i.volume ? '<span class="cart-row-volume">' + i.volume + '</span>' : '') + '</div>' +
          '</div>' +
          '<div class="cart-row-qty"><input type="number" min="1" value="' + i.qty + '" data-qty="' + i.slug + '" aria-label="Quantidade"/></div>' +
          '<div class="cart-row-price">' + money(i.price) + '</div>' +
          '<div class="cart-row-total">' + money(i.price * i.qty) + '</div>' +
          '<button type="button" class="cart-row-remove" data-remove="' + i.slug + '" aria-label="Remover ' + i.name + '">✕</button>';
        tbody.appendChild(row);
      });
      tbody.querySelectorAll('[data-qty]').forEach(function (input) {
        input.addEventListener('change', function () { setQty(input.getAttribute('data-qty'), Number(input.value)); });
      });
      tbody.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () { remove(btn.getAttribute('data-remove')); });
      });
    }

    var subtotalEl = document.getElementById('cart-subtotal');
    var discountRow = document.getElementById('cart-discount-row');
    var discountEl = document.getElementById('cart-discount');
    var totalEl = document.getElementById('cart-total');
    if (subtotalEl) subtotalEl.textContent = money(subtotal());
    if (appliedCoupon && discountAmount() > 0) {
      if (discountRow) discountRow.hidden = false;
      if (discountEl) discountEl.textContent = '- ' + money(discountAmount()) + ' (' + appliedCoupon.code + ')';
    } else if (discountRow) {
      discountRow.hidden = true;
    }
    if (totalEl) totalEl.textContent = money(total());

    var checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = list.length === 0;
  }

  function render() {
    renderBadge();
    renderMiniCart();
    renderCartPage();
  }

  /* ---------- Bind: add-to-cart buttons anywhere on the page ---------- */
  function bind(root) {
    (root || document).querySelectorAll('[data-add-to-cart]').forEach(function (btn) {
      if (btn.dataset.cartBound) return;
      btn.dataset.cartBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var product = JSON.parse(btn.getAttribute('data-add-to-cart'));
        var qtyInput = btn.getAttribute('data-qty-input') ? document.getElementById(btn.getAttribute('data-qty-input')) : null;
        add(product, qtyInput ? Number(qtyInput.value) : 1);
      });
    });

    var miniToggle = document.getElementById('mini-cart-toggle');
    var miniPanel = document.getElementById('mini-cart');
    if (miniToggle && miniPanel && !miniToggle.dataset.bound) {
      miniToggle.dataset.bound = '1';
      miniToggle.addEventListener('click', function (e) {
        e.preventDefault();
        var open = miniPanel.classList.toggle('is-open');
        miniToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!miniPanel.classList.contains('is-open')) return;
        if (miniPanel.contains(e.target) || miniToggle.contains(e.target)) return;
        miniPanel.classList.remove('is-open');
        miniToggle.setAttribute('aria-expanded', 'false');
      });
    }

    var couponForm = document.getElementById('coupon-form');
    if (couponForm && !couponForm.dataset.bound) {
      couponForm.dataset.bound = '1';
      couponForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = document.getElementById('coupon-code');
        var msg = document.getElementById('coupon-message');
        if (!input || !input.value.trim()) return;
        applyCoupon(input.value.trim())
          .then(function (c) {
            if (msg) { msg.textContent = 'Cupom "' + c.code + '" aplicado: ' + c.label + '.'; msg.className = 'coupon-message is-ok'; }
          })
          .catch(function (err) {
            if (msg) { msg.textContent = err.message; msg.className = 'coupon-message is-error'; }
          });
      });
    }

    var checkoutBtn = document.getElementById('checkout-btn');
    var checkoutPanel = document.getElementById('checkout-panel');
    if (checkoutBtn && checkoutPanel && !checkoutBtn.dataset.bound) {
      checkoutBtn.dataset.bound = '1';
      checkoutBtn.addEventListener('click', function () {
        checkoutPanel.hidden = false;
        checkoutPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      var waBtn = document.getElementById('checkout-whatsapp-btn');
      if (waBtn) waBtn.addEventListener('click', function () { waBtn.href = whatsappCheckoutUrl(); });
    }

    render();
  }

  window.VeriteCart = {
    add: add, setQty: setQty, remove: remove, clear: clear,
    count: count, subtotal: subtotal, total: total, discountAmount: discountAmount,
    applyCoupon: applyCoupon, clearCoupon: clearCoupon,
    money: money, render: render, bind: bind
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bind(document); });
  } else {
    bind(document);
  }
})();
