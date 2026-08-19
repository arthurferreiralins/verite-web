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

  var stepChoice = document.getElementById('gate-step-choice');
  var stepCode = document.getElementById('gate-step-code');
  var stepRegister = document.getElementById('gate-step-register');
  var stepBasicRegister = document.getElementById('gate-step-basic-register');
  var stepLogin = document.getElementById('gate-step-login');
  var stepSuccess = document.getElementById('gate-step-success');
  var ALL_GATE_STEPS = [stepChoice, stepCode, stepRegister, stepBasicRegister, stepLogin, stepSuccess];

  var pendingCode = '';
  var currentCustomer = null;

  function hideLoading() { loading.classList.add('is-hidden'); }

  function showGateStep(step) {
    ALL_GATE_STEPS.forEach(function (s) { s.hidden = (s !== step); });
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

  /* ============================ Gate: escolha de entrada ============================ */
  document.getElementById('choice-login-btn').addEventListener('click', function () { showGateStep(stepLogin); });
  document.getElementById('choice-code-btn').addEventListener('click', function () { showGateStep(stepCode); });
  document.getElementById('choice-basic-btn').addEventListener('click', function () { showGateStep(stepBasicRegister); });
  document.getElementById('code-back-btn').addEventListener('click', function () { hideMessage('code-message'); showGateStep(stepChoice); });
  document.getElementById('basic-register-back-btn').addEventListener('click', function () { hideMessage('basic-register-message'); showGateStep(stepChoice); });
  document.getElementById('login-back-btn').addEventListener('click', function () { hideMessage('login-message'); showGateStep(stepChoice); });

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

  /* ============================ Gate: cadastro (código -> Membro Verité) ============================ */
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

  /* ============================ Gate: cadastro sem código (Iniciante) ============================ */
  document.getElementById('basic-register-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    hideMessage('basic-register-message');
    var password = document.getElementById('basic-reg-password').value;
    var passwordConfirm = document.getElementById('basic-reg-password-confirm').value;
    var body = {
      name: document.getElementById('basic-reg-name').value.trim(),
      email: document.getElementById('basic-reg-email').value.trim(),
      password: password,
      passwordConfirm: passwordConfirm
    };
    if (!body.name) { showMessage('basic-register-message', 'Informe seu nome.', true); return; }
    if (password.length < 6) { showMessage('basic-register-message', 'A senha precisa ter pelo menos 6 caracteres.', true); return; }
    if (password !== passwordConfirm) { showMessage('basic-register-message', 'As senhas não coincidem.', true); return; }
    setBtnLoading(form, true);
    api('/api/club/register-basic', { method: 'POST', body: body })
      .then(function (data) {
        setBtnLoading(form, false);
        currentCustomer = data.customer;
        revealSuccessThenDashboard();
      })
      .catch(function (err) {
        setBtnLoading(form, false);
        showMessage('basic-register-message', err.message, true);
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
    var isMembro = Boolean(currentCustomer && currentCustomer.club_member);
    document.getElementById('gate-success-title').textContent = isMembro ? 'Bem-vindo ao Clube Verité' : 'Bem-vindo à Verité';
    document.getElementById('gate-success-lead').textContent = isMembro ? 'Você agora faz parte do Clube Verité.' : 'Você começou sua jornada Verité como Iniciante.';
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

  var CLUB_ROUTES = ['inicio', 'cartao', 'beneficios', 'pontos', 'cupons', 'exclusivos', 'presentes', 'compras', 'favoritos', 'novidades', 'minha-conta'];
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

  /** Grade premium (foto/badges/favorito/carrinho/ver perfume) — a mesma
   *  usada na loja principal. Some inteira (empty state elegante) quando
   *  não há produto nenhum, nunca inventa item. */
  function renderProductGrid(containerId, items, emptyTitle, emptySub) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var wrap = container.closest('.club-home-block');
    if (!items.length) {
      if (wrap) { wrap.hidden = true; return; }
      container.innerHTML = '';
      var empty = el('div', 'club-empty');
      empty.appendChild(el('p', 'club-empty-title', emptyTitle || 'Em preparação.'));
      if (emptySub) empty.appendChild(el('p', 'club-empty-sub', emptySub));
      container.appendChild(empty);
      return;
    }
    if (wrap) wrap.hidden = false;
    if (window.VeriteProducts) window.VeriteProducts.renderGrid(container, items);
  }

  /* ---- Tipo de conta (Iniciante / Membro Verité) ---- */
  function isMembroVerite() { return Boolean(currentCustomer && currentCustomer.club_member); }

  function renderMembershipBadge(tagId, msgId, ctaId) {
    var tag = document.getElementById(tagId);
    var msg = document.getElementById(msgId);
    var cta = ctaId ? document.getElementById(ctaId) : null;
    var membro = isMembroVerite();
    tag.textContent = membro ? 'Membro Verité' : 'Iniciante';
    tag.className = 'membership-badge-tag' + (membro ? ' is-membro' : '');
    msg.textContent = membro ? 'Você faz parte do Clube Verité.' : 'Comece sua jornada Verité.';
    if (cta) cta.hidden = membro;
  }

  function lockedState(title, sub) {
    var box = el('div', 'club-locked-state');
    box.appendChild(el('span', 'club-locked-icon', '🔒'));
    box.appendChild(el('p', 'club-locked-title', title || 'EXCLUSIVO PARA MEMBROS VERITÉ'));
    box.appendChild(el('p', 'club-locked-sub', sub || 'Ative um código Verité para liberar benefícios de membro.'));
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'club-link-btn'; btn.textContent = 'Ativar Meu Código Verité';
    btn.addEventListener('click', function () { navigateClub('minha-conta'); });
    box.appendChild(btn);
    return box;
  }

  /* ---- Início ---- */
  function loadInicio() {
    document.getElementById('home-name').textContent = currentCustomer.name || '';
    renderMembershipBadge('home-membership-tag', 'home-membership-msg', 'home-activate-code-btn');

    var beneficiosBlock = document.getElementById('home-beneficios').closest('.club-home-block');
    var exclusivosBlock = document.getElementById('home-exclusivos').closest('.club-home-block');

    if (!isMembroVerite()) {
      document.getElementById('home-tier-progress').hidden = true;
      document.getElementById('home-tier-value').textContent = 'Iniciante';
      document.getElementById('home-benefits-count').textContent = '0';
      document.getElementById('home-coupons-count').textContent = '0';
      document.getElementById('home-points-count').textContent = '0';
      if (beneficiosBlock) beneficiosBlock.hidden = true;
      if (exclusivosBlock) exclusivosBlock.hidden = true;
    } else {
      document.getElementById('home-tier-progress').hidden = false;
      api('/api/club/tier').then(function (data) {
        renderTierProgress('home-tier-progress', 'home-tier-name', 'home-tier-remaining', 'home-tier-bar-fill', data);
        document.getElementById('home-tier-value').textContent = data.currentTier ? data.currentTier.name : '—';
      }).catch(function () {});

      api('/api/club/points').then(function (data) {
        document.getElementById('home-points-count').textContent = String(data.balance);
      }).catch(function () {});

      api('/api/club/benefits').then(function (data) {
        var available = data.items.filter(function (b) { return b.status === 'disponivel'; });
        document.getElementById('home-benefits-count').textContent = String(available.length);
        var grid = document.getElementById('home-beneficios');
        clear(grid);
        var preview = data.items.filter(function (b) { return b.status !== 'bloqueado'; }).slice(0, 3);
        if (!preview.length) { if (beneficiosBlock) beneficiosBlock.hidden = true; return; }
        if (beneficiosBlock) beneficiosBlock.hidden = false;
        preview.forEach(function (b) { grid.appendChild(benefitCard(b)); });
      }).catch(function () {});

      api('/api/club/coupons').then(function (data) {
        var active = data.items.filter(function (c) { return c.status === 'ativo'; });
        document.getElementById('home-coupons-count').textContent = String(active.length);
      }).catch(function () {});

      api('/api/club/products?kind=exclusivos').then(function (data) {
        renderProductGrid('home-exclusivos', data.items.slice(0, 4));
      }).catch(function () {});
    }

    api('/api/club/orders').then(function (data) {
      document.getElementById('home-orders-count').textContent = String(data.items.length);
    }).catch(function () {});

    api('/api/club/products?kind=destaques').then(function (data) {
      renderProductGrid('home-recomendados', data.items.slice(0, 4));
    }).catch(function () {});

    var grid = document.getElementById('home-novidades');
    clear(grid);
    var newsWrap = grid.closest('.club-home-block');
    api('/api/club/news').then(function (data) {
      if (!data.items.length) { if (newsWrap) newsWrap.hidden = true; return; }
      if (newsWrap) newsWrap.hidden = false;
      data.items.slice(0, 4).forEach(function (n) { grid.appendChild(newsMiniCard(n)); });
    }).catch(function () {});
  }
  routeLoaders.inicio = loadInicio;

  function newsMiniCard(n) {
    var card = el('div', 'product-mini-card');
    var media = el('div', 'product-mini-media');
    if (n.image_url) {
      var img = document.createElement('img');
      img.src = n.image_url; img.alt = n.title;
      media.appendChild(img);
    } else {
      media.appendChild(el('span', 'product-mini-media-empty', 'V'));
    }
    card.appendChild(media);
    var body = el('div', 'product-mini-body');
    body.appendChild(el('p', 'product-mini-name', n.title));
    body.appendChild(el('p', 'product-mini-price', formatDate(n.published_at)));
    card.appendChild(body);
    return card;
  }

  function renderTierProgress(wrapId, nameId, remainingId, fillId, data) {
    var wrap = document.getElementById(wrapId);
    if (!wrap) return;
    document.getElementById(nameId).textContent = data.currentTier ? data.currentTier.name : '—';
    var remainingEl = document.getElementById(remainingId);
    var fillEl = document.getElementById(fillId);
    if (data.nextTier) {
      remainingEl.textContent = formatMoney(data.remainingToNextTier) + ' em compras para ' + data.nextTier.name;
      var span = Number(data.nextTier.min_spent) - Number(data.currentTier.min_spent);
      var progressed = span > 0 ? (data.totalSpent - Number(data.currentTier.min_spent)) / span : 1;
      fillEl.style.width = Math.max(0, Math.min(100, progressed * 100)) + '%';
    } else {
      remainingEl.textContent = 'Nível máximo alcançado.';
      fillEl.style.width = '100%';
    }
  }

  /* ---- Cartão digital ---- */
  function loadCartao() {
    var wrap = document.getElementById('card-wrap');
    clear(wrap);
    api('/api/club/card').then(function (data) {
      if (!data.card) {
        wrap.appendChild(lockedState('CARTÃO EXCLUSIVO PARA MEMBROS VERITÉ', 'Ative um código Verité para receber seu cartão digital com QR code e número de membro.'));
        return;
      }
      var c = data.card;
      var card = el('div', 'digital-card');
      card.appendChild(el('p', 'digital-card-brand', 'VERITÉ'));
      card.appendChild(el('p', 'digital-card-club', 'CLUBE VERITÉ'));
      card.appendChild(el('p', 'digital-card-name', c.name));
      var meta = el('div', 'digital-card-meta');
      var tierBox = el('div', 'digital-card-meta-item');
      tierBox.appendChild(el('span', 'digital-card-meta-label', 'Nível'));
      tierBox.appendChild(el('span', 'digital-card-meta-value', c.tierName || '—'));
      meta.appendChild(tierBox);
      var sinceBox = el('div', 'digital-card-meta-item');
      sinceBox.appendChild(el('span', 'digital-card-meta-label', 'Membro desde'));
      sinceBox.appendChild(el('span', 'digital-card-meta-value', c.memberSince ? String(c.memberSince) : '—'));
      meta.appendChild(sinceBox);
      card.appendChild(meta);
      var numberRow = el('div', 'digital-card-number-row');
      numberRow.appendChild(el('span', 'digital-card-number', c.memberNumber || '—'));
      if (c.qrDataUrl) {
        var qrImg = document.createElement('img');
        qrImg.className = 'digital-card-qr'; qrImg.src = c.qrDataUrl; qrImg.alt = 'QR code do cartão';
        numberRow.appendChild(qrImg);
      }
      card.appendChild(numberRow);
      wrap.appendChild(card);
    }).catch(function (err) {
      wrap.appendChild(el('div', 'club-empty', err.message));
    });
  }
  routeLoaders.cartao = loadCartao;

  /* ---- Benefícios ---- */
  function benefitCard(b) {
    var card = el('div', 'club-card benefit-card');
    card.appendChild(el('h3', null, b.name));
    if (b.description) card.appendChild(el('p', null, b.description));
    if (b.tier_name) card.appendChild(el('p', 'benefit-tier-req', 'Nível necessário: ' + b.tier_name));
    if (b.validity_note) card.appendChild(el('p', 'benefit-validity', b.validity_note));
    var actionRow = el('div', 'benefit-actions');
    if (b.status === 'usado') {
      actionRow.appendChild(el('span', 'benefit-status is-used', 'Utilizado'));
    } else if (b.status === 'bloqueado') {
      actionRow.appendChild(el('span', 'benefit-status is-locked', 'Desbloqueia no nível ' + (b.tier_name || '')));
    } else {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'club-btn-primary club-btn-sm'; btn.textContent = 'Usar Benefício';
      btn.addEventListener('click', function () {
        btn.disabled = true;
        api('/api/club/benefits', { method: 'POST', body: { benefitId: b.id } }).then(function () {
          loadBeneficios();
        }).catch(function (err) { btn.disabled = false; alert(err.message); });
      });
      actionRow.appendChild(btn);
    }
    card.appendChild(actionRow);
    return card;
  }
  function loadBeneficios() {
    var grid = document.getElementById('beneficios-grid');
    clear(grid);
    if (!isMembroVerite()) { grid.appendChild(lockedState()); return; }
    api('/api/club/benefits').then(function (data) {
      if (!data.items.length) {
        grid.appendChild(emptyState('Seus próximos benefícios estão a caminho.', 'Continue aproveitando a Verité para desbloquear novas experiências.'));
        return;
      }
      data.items.forEach(function (b) { grid.appendChild(benefitCard(b)); });
    }).catch(function () {});
  }
  routeLoaders.beneficios = loadBeneficios;

  function emptyState(title, sub) {
    var box = el('div', 'club-empty');
    box.appendChild(el('p', 'club-empty-title', title));
    if (sub) box.appendChild(el('p', 'club-empty-sub', sub));
    return box;
  }

  /* ---- Pontos ---- */
  function loadPontos() {
    var histWrap = document.getElementById('pontos-historico');
    var rulesWrap = document.getElementById('pontos-regras');
    var rewardsWrap = document.getElementById('pontos-recompensas');
    clear(histWrap); clear(rulesWrap); clear(rewardsWrap);
    if (!isMembroVerite()) {
      document.getElementById('pontos-saldo').textContent = '0';
      histWrap.appendChild(lockedState('PONTOS EXCLUSIVOS PARA MEMBROS VERITÉ'));
      return;
    }

    api('/api/club/points').then(function (data) {
      document.getElementById('pontos-saldo').textContent = String(data.balance);

      if (!data.history.length) {
        histWrap.appendChild(emptyState('Nenhuma movimentação ainda.', 'Suas compras e benefícios vão aparecer aqui.'));
      } else {
        var table = document.createElement('table');
        table.className = 'club-table';
        table.innerHTML = '<thead><tr><th>Data</th><th>Motivo</th><th>Pontos</th></tr></thead>';
        var tbody = document.createElement('tbody');
        data.history.forEach(function (h) {
          var tr = document.createElement('tr');
          tr.appendChild(el('td', null, formatDate(h.created_at)));
          tr.appendChild(el('td', null, h.reason));
          tr.appendChild(el('td', 'points-delta ' + (h.delta > 0 ? 'is-positive' : 'is-negative'), (h.delta > 0 ? '+' : '') + h.delta));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        histWrap.appendChild(table);
      }

      if (!data.rules.length) {
        rulesWrap.appendChild(emptyState('Em breve, novas formas de ganhar pontos.'));
      } else {
        data.rules.forEach(function (r) {
          var row = el('div', 'club-rule-item');
          row.appendChild(el('span', 'club-rule-points', '+' + r.points_value));
          var textWrap = el('div', null);
          textWrap.appendChild(el('p', 'club-rule-label', r.label));
          if (r.description) textWrap.appendChild(el('p', 'club-rule-desc', r.description));
          row.appendChild(textWrap);
          rulesWrap.appendChild(row);
        });
      }

      if (!data.rewards.length) {
        rewardsWrap.appendChild(emptyState('Novas recompensas estão a caminho.'));
      } else {
        data.rewards.forEach(function (r) {
          var card = el('div', 'club-card reward-card');
          card.appendChild(el('h3', null, r.name));
          if (r.description) card.appendChild(el('p', null, r.description));
          card.appendChild(el('p', 'reward-cost', r.points_cost + ' pontos'));
          var btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'club-btn-primary club-btn-sm';
          btn.textContent = r.affordable ? 'Trocar' : 'Pontos insuficientes';
          btn.disabled = !r.affordable;
          btn.addEventListener('click', function () {
            btn.disabled = true;
            api('/api/club/points', { method: 'POST', body: { rewardId: r.id } }).then(function () {
              loadPontos();
            }).catch(function (err) { btn.disabled = false; alert(err.message); });
          });
          card.appendChild(btn);
          rewardsWrap.appendChild(card);
        });
      }
    }).catch(function () {});
  }
  routeLoaders.pontos = loadPontos;

  /* ---- Presentes ---- */
  var GIFT_STATUS_LABEL = { disponivel: '🎁 Disponível', bloqueado: '🔒 Ainda não desbloqueado', resgatado: '✓ Resgatado' };
  function loadPresentes() {
    var grid = document.getElementById('presentes-grid');
    clear(grid);
    if (!isMembroVerite()) { grid.appendChild(lockedState('PRESENTES EXCLUSIVOS PARA MEMBROS VERITÉ')); return; }
    api('/api/club/gifts').then(function (data) {
      if (!data.items.length) {
        grid.appendChild(emptyState('Nenhum presente configurado no momento.', 'Fique de olho — a Verité prepara surpresas ao longo do ano.'));
        return;
      }
      data.items.forEach(function (g) {
        var card = el('div', 'club-card gift-card');
        card.appendChild(el('span', 'gift-status gift-status-' + g.status, GIFT_STATUS_LABEL[g.status] || g.status));
        card.appendChild(el('h3', null, g.name));
        if (g.description) card.appendChild(el('p', null, g.description));
        if (g.needsBirthday) card.appendChild(el('p', 'gift-hint', 'Informe sua data de aniversário em Minha Conta para desbloquear este presente.'));
        if (g.status === 'disponivel') {
          var btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'club-btn-primary club-btn-sm'; btn.textContent = 'Resgatar Presente';
          btn.addEventListener('click', function () {
            btn.disabled = true;
            api('/api/club/gifts', { method: 'POST', body: { giftId: g.id } }).then(function () {
              loadPresentes();
            }).catch(function (err) { btn.disabled = false; alert(err.message); });
          });
          card.appendChild(btn);
        }
        grid.appendChild(card);
      });
    }).catch(function () {});
  }
  routeLoaders.presentes = loadPresentes;

  /* ---- Cupons ---- */
  function loadCupons() {
    var grid = document.getElementById('cupons-grid');
    clear(grid);
    if (!isMembroVerite()) { grid.appendChild(lockedState('CUPONS EXCLUSIVOS PARA MEMBROS VERITÉ')); return; }
    api('/api/club/coupons').then(function (data) {
      if (!data.items.length) {
        grid.appendChild(emptyState('Seus próximos cupons estão a caminho.', 'Continue aproveitando a Verité para desbloquear novos descontos.'));
        return;
      }
      data.items.forEach(function (c) {
        var card = el('div', 'club-card coupon-card');
        var statusLabel = c.status === 'ativo' ? 'Disponível' : c.status === 'usado' ? 'Utilizado' : 'Expirado';
        var status = el('span', 'coupon-status' + (c.status === 'ativo' ? ' is-active' : ''), statusLabel);
        card.appendChild(status);
        card.appendChild(el('p', 'coupon-discount', c.discount_label));
        card.appendChild(el('p', 'coupon-name', c.name));
        if (c.description) card.appendChild(el('p', 'coupon-desc', c.description));
        if (c.valid_until) card.appendChild(el('p', 'coupon-validity', 'Válido até ' + formatDate(c.valid_until)));
        var row = el('div', 'coupon-code-row');
        row.appendChild(el('span', 'coupon-code', c.code));
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button'; copyBtn.className = 'coupon-copy-btn'; copyBtn.textContent = 'Copiar Código';
        copyBtn.addEventListener('click', function () {
          navigator.clipboard.writeText(c.code).then(function () {
            copyBtn.textContent = 'Copiado!';
            window.setTimeout(function () { copyBtn.textContent = 'Copiar Código'; }, 1800);
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
        wrap.appendChild(emptyState('Suas próximas compras vão aparecer aqui.', 'Explore a loja e encontre sua próxima fragrância Verité.'));
        return;
      }
      var table = el('table', 'club-table');
      var thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Número</th><th>Data</th><th>Total</th><th>Pagamento</th><th>Status</th><th></th></tr>';
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      data.items.forEach(function (o) {
        var tr = document.createElement('tr');
        tr.appendChild(el('td', null, o.order_number));
        tr.appendChild(el('td', null, formatDate(o.created_at)));
        tr.appendChild(el('td', null, formatMoney(o.total)));
        tr.appendChild(el('td', null, o.payment_method || '—'));
        tr.appendChild(el('td', null, ORDER_STATUS_LABELS[o.status] || o.status));
        var actionsTd = document.createElement('td');
        if (o.tracking_code) {
          var track = document.createElement('a');
          track.className = 'club-link-btn'; track.style.margin = '0'; track.textContent = 'Rastrear Pedido';
          track.href = 'https://rastreamento.correios.com.br/app/index.php?codigo=' + encodeURIComponent(o.tracking_code);
          track.target = '_blank'; track.rel = 'noopener';
          actionsTd.appendChild(track);
        }
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function () {});
  }
  routeLoaders.compras = loadCompras;

  /* ---- Favoritos ---- */
  function loadFavoritos() {
    api('/api/club/favorites').then(function (data) {
      renderProductGrid('favoritos-grid', data.items, 'Nenhum favorito ainda.', 'Explore a loja e salve os perfumes que você mais ama.');
    }).catch(function () {});
  }
  routeLoaders.favoritos = loadFavoritos;

  /* ---- Exclusivos ---- */
  function loadExclusivos() {
    var grid = document.getElementById('exclusivos-grid');
    if (!isMembroVerite()) { clear(grid); grid.appendChild(lockedState('EXCLUSIVO PARA MEMBROS VERITÉ', 'Ative um código Verité para liberar acesso antecipado e fragrâncias exclusivas.')); return; }
    api('/api/club/products?kind=exclusivos').then(function (data) {
      renderProductGrid('exclusivos-grid', data.items, 'Novos exclusivos estão a caminho.', 'Fique de olho — a Verité está preparando fragrâncias só para membros.');
    }).catch(function () {});
  }
  routeLoaders.exclusivos = loadExclusivos;

  /* ---- Novidades ---- */
  function loadNovidades() {
    var wrap = document.getElementById('novidades-lista');
    clear(wrap);
    api('/api/club/news').then(function (data) {
      if (!data.items.length) {
        wrap.appendChild(emptyState('Novidades a caminho.', 'Assim que houver algo novo na Verité, você vê primeiro aqui.'));
        return;
      }
      data.items.forEach(function (n) {
        var card = el('div', 'club-card news-card');
        if (n.image_url) {
          var img = document.createElement('img');
          img.className = 'news-card-img'; img.src = n.image_url; img.alt = n.title;
          card.appendChild(img);
        }
        var body = el('div', 'news-card-body');
        body.appendChild(el('p', 'news-card-date', formatDate(n.published_at)));
        body.appendChild(el('h3', null, n.title));
        var desc = el('p', 'news-card-desc', n.description);
        desc.hidden = true;
        var moreBtn = document.createElement('button');
        moreBtn.type = 'button'; moreBtn.className = 'club-link-btn'; moreBtn.style.margin = '.6rem 0 0'; moreBtn.textContent = 'Saiba Mais';
        moreBtn.addEventListener('click', function () {
          var open = desc.hidden === false;
          desc.hidden = open;
          moreBtn.textContent = open ? 'Saiba Mais' : 'Ver Menos';
        });
        body.appendChild(desc);
        body.appendChild(moreBtn);
        card.appendChild(body);
        wrap.appendChild(card);
      });
    }).catch(function () {});
  }
  routeLoaders.novidades = loadNovidades;

  /* ---- Minha Conta ---- */
  function loadMinhaConta() {
    document.getElementById('acc-name').value = currentCustomer.name || '';
    document.getElementById('acc-email').value = currentCustomer.email || '';
    document.getElementById('acc-phone').value = currentCustomer.phone || '';
    document.getElementById('acc-birthday').value = currentCustomer.birthday ? String(currentCustomer.birthday).slice(0, 10) : '';
    document.getElementById('acc-address').value = currentCustomer.address || '';
    document.getElementById('acc-since').textContent = formatDate(currentCustomer.club_joined_at);
    var membro = isMembroVerite();
    document.getElementById('acc-membership-type').textContent = membro ? 'Membro Verité' : 'Iniciante';
    document.getElementById('acc-member-number-row').hidden = !membro;
    document.getElementById('acc-tier-row').hidden = !membro;
    document.getElementById('acc-member-number').textContent = currentCustomer.member_number || '—';
    document.getElementById('acc-activate-code-box').hidden = membro;
    if (membro) {
      api('/api/club/tier').then(function (data) {
        document.getElementById('acc-tier').textContent = data.currentTier ? data.currentTier.name : '—';
      }).catch(function () {});
    }
  }
  routeLoaders['minha-conta'] = loadMinhaConta;

  document.getElementById('activate-code-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    hideMessage('activate-code-message');
    var code = document.getElementById('activate-code-input').value.trim().toUpperCase();
    if (!code) { showMessage('activate-code-message', 'Digite o código do seu cartão.', true); return; }
    setBtnLoading(form, true);
    api('/api/club/activate-code', { method: 'POST', body: { code: code } })
      .then(function (data) {
        setBtnLoading(form, false);
        currentCustomer = data.customer;
        showMessage('activate-code-message', 'Código ativado! Você agora é Membro Verité.', false);
        window.setTimeout(function () { loadMinhaConta(); loadNotifications(); }, 1200);
      })
      .catch(function (err) {
        setBtnLoading(form, false);
        showMessage('activate-code-message', err.message, true);
      });
  });

  document.getElementById('account-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    hideMessage('account-message');
    var body = {
      name: document.getElementById('acc-name').value.trim(),
      phone: document.getElementById('acc-phone').value.trim(),
      birthday: document.getElementById('acc-birthday').value,
      address: document.getElementById('acc-address').value.trim()
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

  /* ---- Notificações ---- */
  var notifToggle = document.getElementById('club-notif-toggle');
  var notifPanel = document.getElementById('club-notif-panel');
  var notifBadge = document.getElementById('club-notif-badge');

  function loadNotifications() {
    api('/api/club/notifications').then(function (data) {
      notifBadge.hidden = data.unread === 0;
      notifBadge.textContent = String(data.unread);
      clear(notifPanel);
      if (!data.items.length) {
        notifPanel.appendChild(emptyState('Nenhuma notificação por aqui.'));
        return;
      }
      data.items.forEach(function (n) {
        var item = el('div', 'club-notif-item' + (n.read_at ? '' : ' is-unread'));
        item.appendChild(el('p', null, n.message));
        item.appendChild(el('p', 'club-notif-date', formatDate(n.created_at)));
        notifPanel.appendChild(item);
      });
    }).catch(function () {});
  }
  if (notifToggle) {
    notifToggle.addEventListener('click', function () {
      var open = notifPanel.hidden;
      notifPanel.hidden = !open;
      notifToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        api('/api/club/notifications', { method: 'PUT', body: {} }).then(function () { loadNotifications(); }).catch(function () {});
      }
    });
    document.addEventListener('click', function (e) {
      if (!notifPanel.hidden && !notifPanel.contains(e.target) && e.target !== notifToggle) {
        notifPanel.hidden = true;
        notifToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initDashboard() {
    if (dashboardInited) { navigateClub(currentClubRoute()); return; }
    dashboardInited = true;
    navigateClub(currentClubRoute());
    loadNotifications();
  }
}());
