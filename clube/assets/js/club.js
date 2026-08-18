(function () {
  'use strict';

  function api(path, opts) {
    opts = opts || {};
    var fetchOpts = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(opts.body);
    }
    return fetch(path, fetchOpts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) {
          var err = new Error((data && data.error) || 'Erro inesperado. Tente novamente.');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }
  function formatMoney(value) {
    if (value == null) return '—';
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)); }
    catch (e) { return 'R$ ' + value; }
  }
  function formatDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (e) { return iso; }
  }

  var ORDER_STATUS_LABELS = { novo: 'Novo', confirmado: 'Confirmado', preparando: 'Preparando', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };

  /* ============================ Elementos ============================ */
  var loading = document.getElementById('club-loading');
  var gate = document.getElementById('club-gate');
  var dashboard = document.getElementById('club-dashboard');

  var stepCode = document.getElementById('gate-step-code');
  var stepRegister = document.getElementById('gate-step-register');
  var stepLogin = document.getElementById('gate-step-login');
  var stepSuccess = document.getElementById('gate-step-success');

  var pendingCode = '';
  var currentCustomer = null;

  function hideLoading() { loading.classList.add('is-hidden'); }

  function showGateStep(step) {
    [stepCode, stepRegister, stepLogin, stepSuccess].forEach(function (s) { s.hidden = (s !== step); });
  }

  function showMessage(elId, message, isError) {
    var m = document.getElementById(elId);
    m.textContent = message;
    m.hidden = false;
    m.className = 'club-message ' + (isError ? 'is-error' : 'is-ok');
  }
  function hideMessage(elId) {
    document.getElementById(elId).hidden = true;
  }

  function setBtnLoading(form, isLoading) {
    var btn = form.querySelector('button[type="submit"]');
    var spinner = btn.querySelector('.club-spinner');
    btn.disabled = isLoading;
    spinner.hidden = !isLoading;
  }

  /* ============================ Gate: código ============================ */
  document.getElementById('code-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var code = document.getElementById('code-input').value.trim().toUpperCase();
    hideMessage('code-message');
    if (!code) { showMessage('code-message', 'Digite o código do seu cartão.', true); return; }
    if (code === 'VRT-1903') { window.location.href = '/painel'; return; }
    setBtnLoading(form, true);
    api('/api/club/redeem', { method: 'POST', body: { code: code } })
      .then(function () {
        setBtnLoading(form, false);
        pendingCode = code;
        showGateStep(stepRegister);
      })
      .catch(function (err) {
        setBtnLoading(form, false);
        showMessage('code-message', err.message, true);
      });
  });

  document.getElementById('show-login-btn').addEventListener('click', function () {
    hideMessage('code-message');
    showGateStep(stepLogin);
  });
  document.getElementById('show-code-btn').addEventListener('click', function () {
    hideMessage('login-message');
    showGateStep(stepCode);
  });
  document.getElementById('register-back-btn').addEventListener('click', function () {
    hideMessage('register-message');
    showGateStep(stepCode);
  });

  /* ============================ Gate: cadastro ============================ */
  document.getElementById('register-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    hideMessage('register-message');
    var body = {
      code: pendingCode,
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      password: document.getElementById('reg-password').value
    };
    if (!body.name) { showMessage('register-message', 'Informe seu nome.', true); return; }
    if (body.password.length < 6) { showMessage('register-message', 'A senha precisa ter pelo menos 6 caracteres.', true); return; }
    setBtnLoading(form, true);
    api('/api/club/register', { method: 'POST', body: body })
      .then(function (data) {
        setBtnLoading(form, false);
        currentCustomer = data.customer;
        revealSuccessThenDashboard();
      })
      .catch(function (err) {
        setBtnLoading(form, false);
        showMessage('register-message', err.message, true);
      });
  });

  /* ============================ Gate: login ============================ */
  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    hideMessage('login-message');
    var body = {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    };
    setBtnLoading(form, true);
    api('/api/club/login', { method: 'POST', body: body })
      .then(function (data) {
        setBtnLoading(form, false);
        currentCustomer = data.customer;
        revealSuccessThenDashboard();
      })
      .catch(function (err) {
        setBtnLoading(form, false);
        showMessage('login-message', err.message, true);
      });
  });

  function revealSuccessThenDashboard() {
    if (window.VeriteFavorites) window.VeriteFavorites.mergeGuestFavoritesIntoAccount();
    showGateStep(stepSuccess);
    window.setTimeout(function () {
      gate.style.display = 'none';
      dashboard.hidden = false;
      initDashboard();
    }, 1500);
  }

  /* ============================ Logout ============================ */
  document.getElementById('club-logout-btn').addEventListener('click', function () {
    api('/api/club/logout', { method: 'POST' }).then(function () {
      window.location.reload();
    }).catch(function () { window.location.reload(); });
  });

  /* ============================ Sessão inicial ============================ */
  api('/api/club/me')
    .then(function (data) {
      currentCustomer = data.customer;
      hideLoading();
      gate.style.display = 'none';
      dashboard.hidden = false;
      initDashboard();
    })
    .catch(function () {
      hideLoading();
      dashboard.hidden = true;
    });

  /* ============================ Dashboard ============================ */
  var dashboardInited = false;
  var clubNav = document.getElementById('club-nav');
  var navScrim = document.getElementById('club-nav-scrim');
  var menuToggle = document.getElementById('club-menu-toggle');

  function closeNav() {
    clubNav.classList.remove('is-open');
    navScrim.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle.addEventListener('click', function () {
    var open = clubNav.classList.toggle('is-open');
    navScrim.hidden = !open;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navScrim.addEventListener('click', closeNav);

  var CLUB_ROUTES = ['inicio', 'beneficios', 'cupons', 'compras', 'favoritos', 'exclusivos', 'novidades', 'minha-conta'];
  var routeLoaders = {};

  function currentClubRoute() {
    var hash = window.location.hash.replace('#', '');
    return CLUB_ROUTES.indexOf(hash) !== -1 ? hash : 'inicio';
  }

  function navigateClub(route) {
    if (CLUB_ROUTES.indexOf(route) === -1) route = 'inicio';
    document.querySelectorAll('[data-club-section]').forEach(function (s) {
      s.hidden = s.getAttribute('data-club-section') !== route;
    });
    document.querySelectorAll('[data-club-route]').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-club-route') === route);
    });
    closeNav();
    if (window.location.hash !== '#' + route) window.location.hash = route;
    if (routeLoaders[route]) routeLoaders[route]();
  }

  document.querySelectorAll('[data-club-route]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      navigateClub(a.getAttribute('data-club-route'));
    });
  });
  window.addEventListener('hashchange', function () { navigateClub(currentClubRoute()); });

  var favoriteSlugs = [];

  function productMiniCard(p, opts) {
    opts = opts || {};
    var card = document.createElement(opts.asLink === false ? 'div' : 'a');
    card.className = 'product-mini-card';
    if (opts.asLink !== false) card.href = '/produto.html?slug=' + encodeURIComponent(p.slug);
    var media = el('div', 'product-mini-media');
    if (p.main_image_url) {
      var img = document.createElement('img');
      img.src = p.main_image_url; img.alt = p.name;
      media.appendChild(img);
    } else {
      media.appendChild(el('span', 'product-mini-media-empty', 'V'));
    }
    card.appendChild(media);
    var body = el('div', 'product-mini-body');
    body.appendChild(el('p', 'product-mini-name', p.name));
    var price = p.sale_price != null ? p.sale_price : p.price;
    body.appendChild(el('p', 'product-mini-price', price != null ? formatMoney(price) : 'Em breve'));
    card.appendChild(body);
    if (opts.removeFavorite) {
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'product-mini-fav-remove'; rm.textContent = 'Remover dos favoritos';
      rm.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        api('/api/club/favorites?slug=' + encodeURIComponent(p.slug), { method: 'DELETE' }).then(function () {
          loadFavoritos();
        });
      });
      card.appendChild(rm);
    }
    return card;
  }

  /* ---- Início ---- */
  function loadInicio() {
    document.getElementById('home-name').textContent = currentCustomer.name || '';
    document.getElementById('home-since').textContent = currentCustomer.club_joined_at
      ? 'Desde ' + formatDate(currentCustomer.club_joined_at) : '';

    api('/api/club/orders').then(function (data) {
      document.getElementById('home-orders-count').textContent = String(data.items.length);
      document.getElementById('home-last-order').textContent = data.items.length
        ? formatDate(data.items[0].created_at) : 'Nenhum ainda';
    }).catch(function () {});

    api('/api/club/coupons').then(function (data) {
      var active = data.items.filter(function (c) { return c.status === 'ativo'; });
      document.getElementById('home-coupons-count').textContent = String(active.length);
    }).catch(function () {});

    var grid = document.getElementById('home-novidades');
    clear(grid);
    api('/api/club/products?kind=novidades').then(function (data) {
      data.items.slice(0, 4).forEach(function (p) { grid.appendChild(productMiniCard(p)); });
    }).catch(function () {});
  }
  routeLoaders.inicio = loadInicio;

  /* ---- Benefícios ---- */
  var STATIC_BENEFITS = [
    { title: 'Ofertas exclusivas', desc: 'Condições especiais reservadas para membros do Clube.' },
    { title: 'Acesso antecipado', desc: 'Conheça lançamentos e coleções antes de todo mundo.' },
    { title: 'Brinde em próxima compra', desc: 'Uma surpresa Verité te espera no seu próximo pedido.' },
    { title: 'Frete grátis', desc: 'Em condições selecionadas para membros do Clube.' }
  ];
  function loadBeneficios() {
    var grid = document.getElementById('beneficios-grid');
    clear(grid);
    api('/api/club/coupons').then(function (data) {
      data.items.filter(function (c) { return c.status === 'ativo'; }).forEach(function (c) {
        var card = el('div', 'club-card benefit-card');
        card.appendChild(el('h3', null, c.discount_label));
        card.appendChild(el('p', null, c.description || c.name));
        grid.appendChild(card);
      });
      STATIC_BENEFITS.forEach(function (b) {
        var card = el('div', 'club-card benefit-card');
        card.appendChild(el('h3', null, b.title));
        card.appendChild(el('p', null, b.desc));
        grid.appendChild(card);
      });
    }).catch(function () {});
  }
  routeLoaders.beneficios = loadBeneficios;

  /* ---- Cupons ---- */
  function loadCupons() {
    var grid = document.getElementById('cupons-grid');
    clear(grid);
    api('/api/club/coupons').then(function (data) {
      if (!data.items.length) {
        grid.appendChild(el('div', 'club-empty', 'Você ainda não tem cupons.'));
        return;
      }
      data.items.forEach(function (c) {
        var card = el('div', 'club-card coupon-card');
        var statusLabel = c.status === 'ativo' ? 'Ativo' : c.status === 'usado' ? 'Usado' : 'Expirado';
        var status = el('span', 'coupon-status' + (c.status === 'ativo' ? ' is-active' : ''), statusLabel);
        card.appendChild(status);
        card.appendChild(el('p', 'coupon-discount', c.discount_label));
        card.appendChild(el('p', 'coupon-name', c.name));
        if (c.description) card.appendChild(el('p', 'coupon-desc', c.description));
        var row = el('div', 'coupon-code-row');
        row.appendChild(el('span', 'coupon-code', c.code));
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button'; copyBtn.className = 'coupon-copy-btn'; copyBtn.textContent = 'Copiar cupom';
        copyBtn.addEventListener('click', function () {
          navigator.clipboard.writeText(c.code).then(function () {
            copyBtn.textContent = 'Copiado!';
            window.setTimeout(function () { copyBtn.textContent = 'Copiar cupom'; }, 1800);
          }).catch(function () {});
        });
        row.appendChild(copyBtn);
        card.appendChild(row);
        grid.appendChild(card);
      });
    }).catch(function () {});
  }
  routeLoaders.cupons = loadCupons;

  /* ---- Compras ---- */
  function loadCompras() {
    var wrap = document.getElementById('compras-wrap');
    clear(wrap);
    api('/api/club/orders').then(function (data) {
      if (!data.items.length) {
        wrap.appendChild(el('div', 'club-empty', 'Você ainda não tem pedidos por aqui.'));
        return;
      }
      var table = el('table', 'club-table');
      var thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Número</th><th>Data</th><th>Total</th><th>Status</th></tr>';
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      data.items.forEach(function (o) {
        var tr = document.createElement('tr');
        tr.appendChild(el('td', null, o.order_number));
        tr.appendChild(el('td', null, formatDate(o.created_at)));
        tr.appendChild(el('td', null, formatMoney(o.total)));
        tr.appendChild(el('td', null, ORDER_STATUS_LABELS[o.status] || o.status));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function () {});
  }
  routeLoaders.compras = loadCompras;

  /* ---- Favoritos ---- */
  function loadFavoritos() {
    var grid = document.getElementById('favoritos-grid');
    clear(grid);
    api('/api/club/favorites').then(function (data) {
      favoriteSlugs = data.items.map(function (p) { return p.slug; });
      if (!data.items.length) {
        grid.appendChild(el('div', 'club-empty', 'Nenhum favorito ainda. Explore a loja e salve seus perfumes preferidos.'));
        return;
      }
      data.items.forEach(function (p) { grid.appendChild(productMiniCard(p, { removeFavorite: true })); });
    }).catch(function () {});
  }
  routeLoaders.favoritos = loadFavoritos;

  /* ---- Exclusivos ---- */
  function loadExclusivos() {
    var grid = document.getElementById('exclusivos-grid');
    clear(grid);
    api('/api/club/products?kind=exclusivos').then(function (data) {
      if (!data.items.length) {
        grid.appendChild(el('div', 'club-empty', 'Em preparação. Novos exclusivos do Clube chegam em breve.'));
        return;
      }
      data.items.forEach(function (p) { grid.appendChild(productMiniCard(p)); });
    }).catch(function () {});
  }
  routeLoaders.exclusivos = loadExclusivos;

  /* ---- Novidades ---- */
  function loadNovidades() {
    var grid = document.getElementById('novidades-grid');
    clear(grid);
    api('/api/club/products?kind=novidades').then(function (data) {
      if (!data.items.length) {
        grid.appendChild(el('div', 'club-empty', 'Em preparação. Novidades da VERITÉ chegam em breve.'));
        return;
      }
      data.items.forEach(function (p) { grid.appendChild(productMiniCard(p)); });
    }).catch(function () {});
  }
  routeLoaders.novidades = loadNovidades;

  /* ---- Minha Conta ---- */
  function loadMinhaConta() {
    document.getElementById('acc-name').value = currentCustomer.name || '';
    document.getElementById('acc-email').value = currentCustomer.email || '';
    document.getElementById('acc-phone').value = currentCustomer.phone || '';
    document.getElementById('acc-since').textContent = formatDate(currentCustomer.club_joined_at);
    document.getElementById('acc-code').textContent = currentCustomer.club_code_used || '—';
  }
  routeLoaders['minha-conta'] = loadMinhaConta;

  document.getElementById('account-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    hideMessage('account-message');
    var body = {
      name: document.getElementById('acc-name').value.trim(),
      phone: document.getElementById('acc-phone').value.trim()
    };
    var currentPassword = document.getElementById('acc-current-password').value;
    var newPassword = document.getElementById('acc-new-password').value;
    if (newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }
    setBtnLoading(form, true);
    api('/api/club/account', { method: 'PUT', body: body })
      .then(function (data) {
        setBtnLoading(form, false);
        currentCustomer = data.customer;
        document.getElementById('acc-current-password').value = '';
        document.getElementById('acc-new-password').value = '';
        showMessage('account-message', 'Dados atualizados com sucesso.', false);
      })
      .catch(function (err) {
        setBtnLoading(form, false);
        showMessage('account-message', err.message, true);
      });
  });

  function initDashboard() {
    if (dashboardInited) { navigateClub(currentClubRoute()); return; }
    dashboardInited = true;
    navigateClub(currentClubRoute());
  }
}());
