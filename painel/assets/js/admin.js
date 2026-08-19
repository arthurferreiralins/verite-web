(function(){
  'use strict';

  /* ============================ API helper ============================ */
  function api(path, opts){
    opts = opts || {};
    var fetchOpts = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if(opts.body !== undefined){
      if(opts.raw){
        fetchOpts.body = opts.body;
        if(opts.contentType) fetchOpts.headers['Content-Type'] = opts.contentType;
      } else {
        fetchOpts.headers['Content-Type'] = 'application/json';
        fetchOpts.body = JSON.stringify(opts.body);
      }
    }
    return fetch(path, fetchOpts).then(function(res){
      if(res.status === 204) return { ok: true };
      return res.json().catch(function(){ return {}; }).then(function(data){
        if(!res.ok){
          var err = new Error((data && data.error) || 'Erro inesperado.');
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  /* ============================ Toasts ============================ */
  var toastContainer = document.getElementById('toast-container');
  function showToast(message, isError){
    var toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' is-error' : '');
    toast.textContent = message;
    toastContainer.appendChild(toast);
    window.setTimeout(function(){ toast.remove(); }, 3600);
  }

  /* ============================ Confirm modal ============================ */
  var confirmModal = document.getElementById('confirm-modal');
  var confirmMessage = document.getElementById('confirm-message');
  var confirmOkBtn = document.getElementById('confirm-ok');
  var confirmCancelBtn = document.getElementById('confirm-cancel');
  function confirmDialog(message){
    return new Promise(function(resolve){
      confirmMessage.textContent = message;
      confirmModal.hidden = false;
      function cleanup(result){
        confirmModal.hidden = true;
        confirmOkBtn.removeEventListener('click', onOk);
        confirmCancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      }
      function onOk(){ cleanup(true); }
      function onCancel(){ cleanup(false); }
      confirmOkBtn.addEventListener('click', onOk);
      confirmCancelBtn.addEventListener('click', onCancel);
    });
  }

  /* ============================ Small DOM helpers ============================ */
  function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }
  function textEl(tag, text, className){
    var n = document.createElement(tag);
    if(className) n.className = className;
    n.textContent = text;
    return n;
  }
  function setLoading(btn, loading){
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
    var spinner = btn.querySelector('.spinner');
    if(spinner) spinner.hidden = !loading;
  }

  var STATUS_LABELS = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' };
  var STOCK_LABELS = { em_estoque: 'Em estoque', baixo: 'Estoque baixo', esgotado: 'Esgotado' };
  var MESSAGE_STATUS_LABELS = { novo: 'Nova', lido: 'Lida', respondido: 'Respondida', arquivado: 'Arquivada' };
  var ORDER_STATUS_LABELS = { novo: 'Novo', confirmado: 'Confirmado', preparando: 'Preparando', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };
  var ALERT_LABELS = { ok: 'Estoque OK', baixo: 'Estoque baixo', critico: 'Estoque crítico' };
  var BATCH_STATUS_LABELS = { produzindo: 'Produzindo', macerando: 'Macerando', pronto: 'Pronto', esgotado: 'Esgotado' };
  var INVENTORY_TYPE_LABELS = { materia_prima: 'Matéria-prima', frasco: 'Frasco', embalagem: 'Embalagem' };
  var INVENTORY_SUBTYPES = {
    materia_prima: [['essencia', 'Essência'], ['alcool_base', 'Álcool/Base'], ['outro', 'Outro ingrediente']],
    frasco: [['frasco', 'Frasco'], ['valvula', 'Válvula'], ['tampa', 'Tampa'], ['rotulo', 'Rótulo']],
    embalagem: [['caixa', 'Caixa'], ['sacola', 'Sacola'], ['cartao', 'Cartão'], ['envio', 'Material de envio']],
  };

  function formatDate(iso){
    if(!iso) return '—';
    try { return new Date(iso).toLocaleString('pt-BR'); } catch(e){ return iso; }
  }
  function formatMoney(value){
    if(value == null || value === '') return '—';
    try { return new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(value)); }
    catch(e){ return String(value); }
  }
  var DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
  function makeSlug(value){
    return String(value || '').toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function attachSlugAutogen(nameInput, slugInput){
    var touched = false;
    slugInput.addEventListener('input', function(){ touched = true; });
    nameInput.addEventListener('input', function(){
      if(touched) return;
      slugInput.value = makeSlug(nameInput.value);
    });
    return { reset: function(alreadyHasValue){ touched = Boolean(alreadyHasValue); } };
  }

  /* ============================ Dirty-form / unsaved changes guard ============================ */
  var dirtyGuard = { active: false, formEl: null };
  function watchDirty(formEl){
    dirtyGuard.formEl = formEl;
    dirtyGuard.active = false;
    var handler = function(){ dirtyGuard.active = true; };
    formEl.addEventListener('input', handler, { once: false });
  }
  function clearDirty(){ dirtyGuard.active = false; }
  function isDirtyFor(formEl){ return dirtyGuard.active && dirtyGuard.formEl === formEl; }
  window.addEventListener('beforeunload', function(e){
    if(dirtyGuard.active){ e.preventDefault(); e.returnValue = ''; }
  });

  /* ============================ Image uploader ============================ */
  function createImageUploader(container, opts){
    // opts: { urls, multiple, folder, onChange, reorderable, onSetMain(url, idx) }
    var urls = (opts.urls || []).slice();
    var folder = opts.folder || 'products';

    function upload(file){
      return api('/api/admin/upload?folder=' + encodeURIComponent(folder), { method: 'POST', raw: true, body: file, contentType: file.type })
        .then(function(data){ return data.url; });
    }

    function render(){
      clear(container);
      urls.forEach(function(url, idx){
        var tile = document.createElement('div');
        tile.className = 'image-tile';
        var img = document.createElement('img');
        img.src = url; img.alt = '';
        tile.appendChild(img);

        var toolbar = document.createElement('div');
        toolbar.className = 'image-tile-toolbar';

        if(opts.reorderable && urls.length > 1){
          var upBtn = document.createElement('button');
          upBtn.type = 'button'; upBtn.textContent = '↑'; upBtn.setAttribute('aria-label', 'Mover para cima');
          upBtn.disabled = idx === 0;
          upBtn.addEventListener('click', function(){
            var tmp = urls[idx - 1]; urls[idx - 1] = urls[idx]; urls[idx] = tmp;
            render(); opts.onChange(urls.slice());
          });
          var downBtn = document.createElement('button');
          downBtn.type = 'button'; downBtn.textContent = '↓'; downBtn.setAttribute('aria-label', 'Mover para baixo');
          downBtn.disabled = idx === urls.length - 1;
          downBtn.addEventListener('click', function(){
            var tmp = urls[idx + 1]; urls[idx + 1] = urls[idx]; urls[idx] = tmp;
            render(); opts.onChange(urls.slice());
          });
          toolbar.appendChild(upBtn); toolbar.appendChild(downBtn);
        }
        if(opts.onSetMain){
          var mainBtn = document.createElement('button');
          mainBtn.type = 'button'; mainBtn.textContent = 'Definir principal'; mainBtn.className = 'image-tile-main-btn';
          mainBtn.addEventListener('click', function(){ opts.onSetMain(url, idx); });
          toolbar.appendChild(mainBtn);
        }
        if(toolbar.childNodes.length) tile.appendChild(toolbar);

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button'; removeBtn.className = 'image-tile-remove';
        removeBtn.setAttribute('aria-label', 'Remover imagem');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', function(){
          urls.splice(idx, 1);
          render();
          opts.onChange(urls.slice());
        });
        tile.appendChild(removeBtn);
        container.appendChild(tile);
      });

      if(opts.multiple || urls.length === 0){
        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'image-add';
        addBtn.textContent = 'Adicionar imagem';
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.hidden = true;
        addBtn.addEventListener('click', function(){ input.click(); });
        input.addEventListener('change', function(){
          var file = input.files[0];
          input.value = '';
          if(!file) return;
          addBtn.textContent = 'Enviando…';
          addBtn.disabled = true;
          upload(file).then(function(url){
            if(opts.multiple){ urls.push(url); } else { urls = [url]; }
            render();
            opts.onChange(urls.slice());
          }).catch(function(err){
            showToast(err.message || 'Falha ao enviar imagem.', true);
          }).finally(function(){
            addBtn.textContent = 'Adicionar imagem';
            addBtn.disabled = false;
          });
        });
        container.appendChild(addBtn);
        container.appendChild(input);
      }
    }
    render();
    return {
      getUrls: function(){ return urls.slice(); },
      setUrls: function(next){ urls = (next || []).slice(); render(); }
    };
  }

  /* ============================ Auth ============================ */
  var loginView = document.getElementById('login-view');
  var appView = document.getElementById('app-view');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');

  var pwToggle = document.getElementById('login-password-toggle');
  var pwInput = document.getElementById('login-password');
  pwToggle.addEventListener('click', function(){
    var show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    pwToggle.textContent = show ? 'Ocultar' : 'Mostrar';
    pwInput.focus();
  });

  function showLogin(){
    loginView.hidden = false;
    appView.hidden = true;
  }
  function showApp(){
    loginView.hidden = true;
    appView.hidden = false;
  }

  loginForm.addEventListener('submit', function(e){
    e.preventDefault();
    var btn = loginForm.querySelector('button[type="submit"]');
    loginError.hidden = true;
    setLoading(btn, true);
    api('/api/admin/login', {
      method: 'POST',
      body: {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      }
    }).then(function(){
      showApp();
      boot();
      navigate(currentRoute() || 'dashboard');
    }).catch(function(err){
      loginError.textContent = err.status === 429 ? err.message : (err.message || 'Não foi possível entrar.');
      loginError.hidden = false;
    }).finally(function(){
      setLoading(btn, false);
    });
  });

  document.getElementById('logout-btn').addEventListener('click', function(){
    api('/api/admin/logout', { method: 'POST' }).finally(function(){
      showLogin();
      window.location.hash = '';
    });
  });

  /* ============================ Sidebar / mobile menu ============================ */
  var sidebar = document.getElementById('sidebar');
  var sidebarScrim = document.getElementById('sidebar-scrim');
  var menuToggle = document.getElementById('menu-toggle');
  function closeSidebar(){
    sidebar.classList.remove('is-open');
    sidebarScrim.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle.addEventListener('click', function(){
    var open = sidebar.classList.toggle('is-open');
    sidebarScrim.hidden = !open;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  sidebarScrim.addEventListener('click', closeSidebar);

  /* ============================ Routing ============================ */
  var ROUTES = ['dashboard', 'produtos', 'categorias', 'producao', 'estoque', 'financeiro', 'pedidos', 'clientes', 'clube', 'leads', 'mensagens', 'conteudo', 'faq', 'midia', 'seo', 'aparencia', 'configuracoes', 'minha-conta'];
  var loaders = {};
  var currentActiveRoute = null;

  function currentRoute(){
    var hash = window.location.hash.replace('#', '');
    return ROUTES.indexOf(hash) !== -1 ? hash : null;
  }

  function reallyNavigate(route){
    if(ROUTES.indexOf(route) === -1) route = 'dashboard';
    document.querySelectorAll('.admin-section').forEach(function(s){ s.hidden = s.getAttribute('data-section') !== route; });
    document.querySelectorAll('[data-route]').forEach(function(a){
      a.classList.toggle('is-active', a.getAttribute('data-route') === route);
    });
    closeSidebar();
    currentActiveRoute = route;
    // Setting location.hash fires an async 'hashchange', which re-enters here
    // via navigate() a second time. Only run the loader on whichever pass is
    // the last one for this navigation (i.e. once the hash already matches) —
    // otherwise the loader's clear()+async-render races itself and duplicates
    // everything it rendered (seen live: every dashboard stat card appeared twice).
    if(window.location.hash !== '#' + route){
      window.location.hash = route;
    } else if(loaders[route]){
      loaders[route]();
    }
  }

  function navigate(route){
    if(dirtyGuard.active){
      confirmDialog('Você tem alterações não salvas. Deseja sair mesmo assim?').then(function(ok){
        if(!ok){
          if(currentActiveRoute && window.location.hash !== '#' + currentActiveRoute) window.location.hash = currentActiveRoute;
          return;
        }
        clearDirty();
        reallyNavigate(route);
      });
      return;
    }
    reallyNavigate(route);
  }

  document.querySelectorAll('[data-route]').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      navigate(a.getAttribute('data-route'));
    });
  });
  window.addEventListener('hashchange', function(){
    var r = currentRoute();
    if(r) navigate(r);
  });

  /* ============================ Global search ============================ */
  var searchInput = document.getElementById('global-search');
  var searchResults = document.getElementById('global-search-results');
  var searchTimer = null;
  function renderSearchResults(results){
    clear(searchResults);
    if(!results.length){
      searchResults.appendChild(textEl('div', 'Nenhum resultado.', 'search-empty'));
      searchResults.hidden = false;
      return;
    }
    results.forEach(function(r){
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'search-result-item';
      item.appendChild(textEl('span', r.label, 'search-result-label'));
      item.appendChild(textEl('span', r.type, 'search-result-type'));
      item.addEventListener('click', function(){
        searchResults.hidden = true;
        searchInput.value = '';
        if(r.type === 'produto'){
          navigate('produtos');
          api('/api/admin/products?id=' + r.id).then(function(data){ showProductForm(data.product); }).catch(function(){});
        } else {
          navigate(r.route);
        }
      });
      searchResults.appendChild(item);
    });
    searchResults.hidden = false;
  }
  searchInput.addEventListener('input', function(){
    window.clearTimeout(searchTimer);
    var q = searchInput.value.trim();
    if(q.length < 2){ searchResults.hidden = true; return; }
    searchTimer = window.setTimeout(function(){
      api('/api/admin/search?q=' + encodeURIComponent(q)).then(function(data){
        renderSearchResults(data.results || []);
      }).catch(function(){ searchResults.hidden = true; });
    }, 300);
  });
  document.addEventListener('click', function(e){
    if(!searchResults.contains(e.target) && e.target !== searchInput) searchResults.hidden = true;
  });

  /* ============================ Notifications ============================ */
  var notifBell = document.getElementById('notif-bell');
  var notifDropdown = document.getElementById('notif-dropdown');
  var notifCount = document.getElementById('notif-count');
  var mensagensNavBadge = document.getElementById('mensagens-nav-badge');

  function loadNotifications(){
    return api('/api/admin/notifications').then(function(data){
      var items = data.items || [];
      notifCount.textContent = String(items.length);
      notifCount.hidden = items.length === 0;
      clear(notifDropdown);
      if(!items.length){
        notifDropdown.appendChild(textEl('div', 'Nenhuma notificação por aqui.', 'notif-empty'));
      } else {
        items.forEach(function(item){
          var row = document.createElement('div');
          row.className = 'notif-item';
          row.appendChild(textEl('div', item.text, 'notif-text'));
          if(item.createdAt) row.appendChild(textEl('div', formatDate(item.createdAt), 'notif-time'));
          notifDropdown.appendChild(row);
        });
      }
      return data;
    }).catch(function(){});
  }
  notifBell.addEventListener('click', function(){
    var open = notifDropdown.hidden;
    notifDropdown.hidden = !open;
    notifBell.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open) loadNotifications();
  });
  document.addEventListener('click', function(e){
    if(!notifDropdown.hidden && !notifDropdown.contains(e.target) && e.target !== notifBell && !notifBell.contains(e.target)){
      notifDropdown.hidden = true;
      notifBell.setAttribute('aria-expanded', 'false');
    }
  });

  function refreshMessagesBadge(){
    api('/api/admin/messages?status=novo').then(function(data){
      var n = (data.items || []).length;
      mensagensNavBadge.textContent = String(n);
      mensagensNavBadge.hidden = n === 0;
    }).catch(function(){});
  }

  /* ============================ Dashboard ============================ */
  var ACTIVITY_VERBS = {
    created: 'criou', updated: 'atualizou', deleted: 'excluiu', duplicated: 'duplicou', status_changed: 'alterou o status de',
  };
  loaders.dashboard = function(){
    var wrap = document.getElementById('dashboard-cards');
    var activityWrap = document.getElementById('dashboard-activity');
    clear(wrap); clear(activityWrap);
    api('/api/admin/dashboard').then(function(data){
      var totalAlerts = data.lowStock + data.lowStockInventory;
      var cards = [
        { n: data.perfumesReady, label: 'PERFUMES PRONTOS', sub: 'frascos disponíveis para venda' },
        { n: data.rawMaterials, label: 'MATÉRIAS-PRIMAS', sub: 'itens cadastrados' },
        { n: totalAlerts, label: 'ESTOQUE BAIXO/CRÍTICO', sub: totalAlerts > 0 ? 'produto(s)/item(ns) para repor' : 'tudo em dia', warn: totalAlerts > 0 },
        { n: data.monthlyProductions, label: 'PRODUÇÕES NO MÊS', sub: null },
        { n: formatMoney(data.monthlyProductionCost), label: 'CUSTO DE PRODUÇÃO (MÊS)', sub: null },
        { n: formatMoney(data.inventoryValue + data.finishedGoodsValue), label: 'VALOR EM ESTOQUE', sub: 'matérias-primas + produtos prontos' },
        { n: formatMoney(data.salesTotal), label: 'VENDAS REALIZADAS', sub: null },
        { n: formatMoney(data.estimatedProfit), label: 'LUCRO ESTIMADO', sub: 'se todo o estoque pronto for vendido' },
        { n: data.productsTotal, label: 'PRODUTOS', sub: data.products.published + ' publicados · ' + data.products.draft + ' rascunhos' },
        { n: data.orders, label: 'PEDIDOS', sub: null },
        { n: data.customers, label: 'CLIENTES', sub: null },
        { n: data.leads, label: 'LISTA DE ESPERA', sub: null },
        { n: data.messagesTotal, label: 'MENSAGENS', sub: data.messages.novo + ' novas' }
      ];
      cards.forEach(function(c){
        var card = document.createElement('div');
        card.className = 'stat-card' + (c.warn ? ' stat-card-warn' : '');
        card.appendChild(textEl('div', String(c.n), 'n'));
        card.appendChild(textEl('div', c.label, 'label'));
        if(c.sub) card.appendChild(textEl('div', c.sub, 'stat-card-sub'));
        wrap.appendChild(card);
      });

      if(!data.activity || !data.activity.length){
        activityWrap.appendChild(textEl('div', 'Nenhuma atividade registrada ainda.', 'empty-state'));
      } else {
        data.activity.forEach(function(item){
          var row = document.createElement('div');
          row.className = 'activity-item';
          row.appendChild(textEl('div', item.description, 'activity-desc'));
          row.appendChild(textEl('div', formatDate(item.created_at), 'activity-time'));
          activityWrap.appendChild(row);
        });
      }
    }).catch(function(err){ showToast(err.message, true); });
    refreshMessagesBadge();

    var alertsWrap = document.getElementById('dashboard-alerts');
    var alertsTitle = document.getElementById('dashboard-alerts-title');
    clear(alertsWrap);
    Promise.all([api('/api/admin/inventory'), api('/api/admin/products')]).then(function(results){
      var alerts = [];
      results[0].items.forEach(function(item){
        if(item.alert_level === 'baixo' || item.alert_level === 'critico'){
          alerts.push({ level: item.alert_level, text: item.name + ' — ' + item.quantity + ' ' + item.unit + ' em estoque' });
        }
      });
      results[1].products.forEach(function(p){
        if(p.track_stock && (p.stock_status === 'baixo' || p.stock_status === 'esgotado')){
          alerts.push({ level: p.stock_status === 'esgotado' ? 'critico' : 'baixo', text: p.name + ' — ' + p.stock_quantity + ' un. em estoque' });
        }
      });
      alerts.sort(function(a, b){ return (a.level === 'critico' ? 0 : 1) - (b.level === 'critico' ? 0 : 1); });
      alertsTitle.hidden = !alerts.length;
      alerts.forEach(function(a){
        var row = document.createElement('div'); row.className = 'activity-item';
        row.appendChild(textEl('div', a.text, 'activity-desc'));
        var badge = document.createElement('span'); badge.className = 'badge badge-alert-' + a.level; badge.textContent = ALERT_LABELS[a.level];
        row.appendChild(badge);
        alertsWrap.appendChild(row);
      });
    }).catch(function(){});
  };

  /* ============================ Categorias (cache usado pelo form de produto) ============================ */
  var categoriesCache = [];
  function loadCategoriesCache(){
    return api('/api/admin/categories').then(function(data){
      categoriesCache = data.items || [];
      return categoriesCache;
    }).catch(function(){ return categoriesCache; });
  }
  function populateProductCategorySelect(){
    var select = document.getElementById('produto-category');
    var current = select.value;
    clear(select);
    categoriesCache.filter(function(c){ return c.active; }).forEach(function(c){
      var opt = document.createElement('option');
      opt.value = c.slug; opt.textContent = c.name;
      select.appendChild(opt);
    });
    if(current) select.value = current;
  }

  /* ============================ Produtos ============================ */
  var produtosListView = document.getElementById('produtos-list-view');
  var produtosFormView = document.getElementById('produtos-form-view');
  var produtoForm = document.getElementById('produto-form');
  var produtoFormTitle = document.getElementById('produto-form-title');
  var produtoImages = null;

  attachSlugAutogen(document.getElementById('produto-name'), document.getElementById('produto-slug'));

  function stockBadgeHtml(p){
    if(!p.track_stock) return '<span class="badge badge-neutral">Não controlado</span>';
    var st = p.stock_status || 'em_estoque';
    return '<span class="badge badge-stock-' + st + '">' + (STOCK_LABELS[st] || st) + '</span>';
  }

  function loadProductsList(){
    var wrap = document.getElementById('produtos-table-wrap');
    clear(wrap);
    api('/api/admin/products').then(function(data){
      if(!data.products.length){
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.appendChild(textEl('p', 'Nenhum produto cadastrado.', 'empty-title'));
        empty.appendChild(textEl('p', 'Cadastre o primeiro produto da VERITÉ quando estiver pronto.'));
        var cta = document.createElement('button');
        cta.type = 'button'; cta.className = 'btn-primary'; cta.textContent = '+ Criar produto';
        cta.style.marginTop = '1rem';
        cta.addEventListener('click', function(){ showProductForm(null); });
        empty.appendChild(cta);
        wrap.appendChild(empty);
        return;
      }
      var catLabel = {};
      categoriesCache.forEach(function(c){ catLabel[c.slug] = c.name; });

      var table = document.createElement('table');
      table.className = 'admin-table';
      var thead = document.createElement('thead');
      thead.innerHTML = '<tr><th></th><th>Nome</th><th>Categoria</th><th>Volume</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Destaque</th><th>Data</th><th></th></tr>';
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      data.products.forEach(function(p){
        var tr = document.createElement('tr');

        var imgTd = document.createElement('td');
        if(p.main_image_url){
          var img = document.createElement('img');
          img.src = p.main_image_url; img.alt = ''; img.className = 'table-thumb';
          imgTd.appendChild(img);
        } else {
          imgTd.appendChild(textEl('div', '—', 'table-thumb-empty'));
        }
        tr.appendChild(imgTd);

        tr.appendChild(textEl('td', p.name));
        tr.appendChild(textEl('td', catLabel[p.category] || p.category));
        tr.appendChild(textEl('td', p.volume || '—'));
        tr.appendChild(textEl('td', formatMoney(p.price)));

        var stockTd = document.createElement('td');
        stockTd.innerHTML = stockBadgeHtml(p) + ' <span class="stock-qty">' + (p.track_stock ? p.stock_quantity + ' un.' : '') + '</span>';
        tr.appendChild(stockTd);

        var statusTd = document.createElement('td');
        statusTd.appendChild(textEl('span', STATUS_LABELS[p.status] || p.status, 'badge badge-' + p.status));
        tr.appendChild(statusTd);
        tr.appendChild(textEl('td', p.featured ? 'Sim' : 'Não'));
        tr.appendChild(textEl('td', formatDate(p.created_at)));

        var actionsTd = document.createElement('td');
        actionsTd.className = 'table-actions';

        var viewBtn = document.createElement('a');
        viewBtn.href = 'https://verite-web.vercel.app/produto.html?slug=' + encodeURIComponent(p.slug);
        viewBtn.target = '_blank'; viewBtn.rel = 'noopener'; viewBtn.textContent = 'Visualizar';
        actionsTd.appendChild(viewBtn);

        var editBtn = document.createElement('button');
        editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showProductForm(p); });
        actionsTd.appendChild(editBtn);

        var dupBtn = document.createElement('button');
        dupBtn.type = 'button'; dupBtn.textContent = 'Duplicar';
        dupBtn.addEventListener('click', function(){
          api('/api/admin/products', { method: 'POST', body: { duplicateFrom: p.id } }).then(function(){
            showToast('Produto duplicado.');
            loadProductsList();
          }).catch(function(err){ showToast(err.message, true); });
        });
        actionsTd.appendChild(dupBtn);

        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.textContent = p.status === 'published' ? 'Despublicar' : 'Publicar';
        toggleBtn.addEventListener('click', function(){
          var nextStatus = p.status === 'published' ? 'draft' : 'published';
          api('/api/admin/products?id=' + p.id, { method: 'PUT', body: { status: nextStatus } }).then(function(){
            showToast(nextStatus === 'published' ? 'Produto publicado.' : 'Produto despublicado.');
            loadProductsList();
          }).catch(function(err){ showToast(err.message, true); });
        });
        actionsTd.appendChild(toggleBtn);

        if(p.status !== 'archived'){
          var archiveBtn = document.createElement('button');
          archiveBtn.type = 'button'; archiveBtn.textContent = 'Arquivar';
          archiveBtn.addEventListener('click', function(){
            api('/api/admin/products?id=' + p.id, { method: 'PUT', body: { status: 'archived' } }).then(function(){
              showToast('Produto arquivado.');
              loadProductsList();
            }).catch(function(err){ showToast(err.message, true); });
          });
          actionsTd.appendChild(archiveBtn);
        }

        var delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.textContent = 'Excluir';
        delBtn.addEventListener('click', function(){
          confirmDialog('Tem certeza que deseja excluir "' + p.name + '"? Essa ação não pode ser desfeita.').then(function(ok){
            if(!ok) return;
            api('/api/admin/products?id=' + p.id, { method: 'DELETE' }).then(function(){
              showToast('Produto excluído.');
              loadProductsList();
            }).catch(function(err){ showToast(err.message, true); });
          });
        });
        actionsTd.appendChild(delBtn);

        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }

  function fillOptional(id, value){ document.getElementById(id).value = value || ''; }

  var PRODUTO_COST_IDS = ['produto-cost-essence', 'produto-cost-base', 'produto-cost-bottle', 'produto-cost-cap', 'produto-cost-label', 'produto-cost-packaging'];
  function produtoCostTotal(){
    return PRODUTO_COST_IDS.reduce(function(sum, id){ return sum + (Number(document.getElementById(id).value) || 0); }, 0);
  }
  function updateProdutoCostSummary(){
    var cost = produtoCostTotal();
    var price = Number(document.getElementById('produto-sale-price').value) || Number(document.getElementById('produto-price').value) || 0;
    var summary = document.getElementById('produto-cost-summary');
    var html = '<div><strong>Custo total:</strong> ' + formatMoney(cost) + '</div>';
    if(price > 0){
      var profit = price - cost;
      var margin = profit / price * 100;
      var cls = profit >= 0 ? 'profit-positive' : 'profit-negative';
      html += '<div><strong>Lucro por unidade:</strong> <span class="' + cls + '">' + formatMoney(profit) + '</span></div>';
      html += '<div><strong>Margem:</strong> <span class="' + cls + '">' + margin.toFixed(1) + '%</span></div>';
    } else {
      html += '<div>Informe o preço de venda para calcular o lucro.</div>';
    }
    summary.innerHTML = html;
  }
  PRODUTO_COST_IDS.concat(['produto-price', 'produto-sale-price']).forEach(function(id){
    document.getElementById(id).addEventListener('input', updateProdutoCostSummary);
  });

  function loadProdutoBatches(productId){
    var summaryWrap = document.getElementById('produto-batches-summary');
    var listWrap = document.getElementById('produto-batches-list');
    clear(summaryWrap); clear(listWrap);
    api('/api/admin/products?id=' + productId).then(function(data){
      var cost = Number(data.product.cost_essence||0) + Number(data.product.cost_base||0) + Number(data.product.cost_bottle||0) + Number(data.product.cost_cap||0) + Number(data.product.cost_label||0) + Number(data.product.cost_packaging||0);
      var price = data.product.sale_price != null ? Number(data.product.sale_price) : Number(data.product.price || 0);
      var profitGenerated = data.soldQuantity * (price - cost);
      summaryWrap.innerHTML = '<div><strong>Quantidade vendida:</strong> ' + data.soldQuantity + ' un.</div><div><strong>Lucro gerado (estimado):</strong> ' + formatMoney(profitGenerated) + '</div>';
      if(!data.batches.length){
        listWrap.appendChild(textEl('div', 'Nenhum lote de produção registrado para este perfume ainda.', 'empty-state'));
        return;
      }
      var table = document.createElement('table'); table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Lote</th><th>Data</th><th>Frascos</th><th>Custo</th><th>Status</th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.batches.forEach(function(b){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', b.lote_code, 'lote-code'));
        tr.appendChild(textEl('td', formatDate(b.production_date)));
        tr.appendChild(textEl('td', String(b.bottle_count)));
        tr.appendChild(textEl('td', formatMoney(b.production_cost)));
        tr.appendChild(textEl('td', BATCH_STATUS_LABELS[b.status] || b.status));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      listWrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }

  function showProductForm(product){
    produtosListView.hidden = true;
    produtosFormView.hidden = false;
    produtoForm.reset();
    document.getElementById('produto-delete-btn').hidden = !product;
    produtoFormTitle.textContent = product ? 'Editar produto' : 'Novo produto';
    document.getElementById('produto-id').value = product ? product.id : '';
    document.getElementById('produto-name').value = product ? product.name : '';
    document.getElementById('produto-slug').value = product ? product.slug : '';
    populateProductCategorySelect();
    document.getElementById('produto-category').value = product ? product.category : (categoriesCache[0] ? categoriesCache[0].slug : '');
    document.getElementById('produto-volume').value = product ? (product.volume || '') : '';
    document.getElementById('produto-price').value = product && product.price != null ? product.price : '';
    document.getElementById('produto-sale-price').value = product && product.sale_price != null ? product.sale_price : '';
    document.getElementById('produto-short-desc').value = product ? (product.short_description || '') : '';
    document.getElementById('produto-desc').value = product ? (product.description || '') : '';
    document.getElementById('produto-status').value = product ? product.status : 'draft';
    document.getElementById('produto-featured').checked = Boolean(product && product.featured);
    document.getElementById('produto-club-exclusive').checked = Boolean(product && product.club_exclusive);
    document.getElementById('produto-bestseller').checked = Boolean(product && product.bestseller);
    document.getElementById('produto-limited-edition').checked = Boolean(product && product.limited_edition);
    document.getElementById('produto-sku').value = product ? (product.sku || '') : '';
    document.getElementById('produto-stock').value = product ? (product.stock_quantity || 0) : 0;
    document.getElementById('produto-track-stock').checked = product ? Boolean(product.track_stock) : true;
    document.getElementById('produto-order').value = product ? (product.sort_order || 0) : 0;
    fillOptional('produto-type', product && product.product_type);
    fillOptional('produto-concentration', product && product.concentration);
    fillOptional('produto-family', product && product.olfactory_family);
    fillOptional('produto-occasion', product && product.occasion);
    fillOptional('produto-audience', product && product.audience);
    fillOptional('produto-intensity', product && product.intensity);
    fillOptional('produto-longevity', product && product.longevity);
    fillOptional('produto-sillage', product && product.sillage);
    fillOptional('produto-notes-top', product && product.notes_top);
    fillOptional('produto-notes-heart', product && product.notes_heart);
    fillOptional('produto-notes-base', product && product.notes_base);
    fillOptional('produto-seo-title', product && product.seo_title);
    fillOptional('produto-seo-description', product && product.seo_description);

    document.getElementById('produto-cost-essence').value = product ? (product.cost_essence || 0) : 0;
    document.getElementById('produto-cost-base').value = product ? (product.cost_base || 0) : 0;
    document.getElementById('produto-cost-bottle').value = product ? (product.cost_bottle || 0) : 0;
    document.getElementById('produto-cost-cap').value = product ? (product.cost_cap || 0) : 0;
    document.getElementById('produto-cost-label').value = product ? (product.cost_label || 0) : 0;
    document.getElementById('produto-cost-packaging').value = product ? (product.cost_packaging || 0) : 0;
    updateProdutoCostSummary();

    var batchesBlock = document.getElementById('produto-batches-block');
    if(product){
      batchesBlock.hidden = false;
      loadProdutoBatches(product.id);
    } else {
      batchesBlock.hidden = true;
    }

    var mainWrap = document.getElementById('produto-main-image');
    var galleryWrap = document.getElementById('produto-gallery');
    var mainUploader = createImageUploader(mainWrap, {
      urls: product && product.main_image_url ? [product.main_image_url] : [],
      multiple: false, folder: 'products', onChange: function(){}
    });
    var galleryUploader = createImageUploader(galleryWrap, {
      urls: product && product.gallery_urls ? product.gallery_urls : [],
      multiple: true, reorderable: true, folder: 'products', onChange: function(){},
      onSetMain: function(url, idx){
        var g = galleryUploader.getUrls();
        var currentMain = mainUploader.getUrls()[0];
        g.splice(idx, 1);
        if(currentMain) g.unshift(currentMain);
        galleryUploader.setUrls(g);
        mainUploader.setUrls([url]);
      }
    });
    produtoImages = { main: mainUploader, gallery: galleryUploader };

    watchDirty(produtoForm);
  }

  document.getElementById('produto-new-btn').addEventListener('click', function(){ showProductForm(null); });
  document.getElementById('produto-back-btn').addEventListener('click', function(){
    if(dirtyGuard.active){
      confirmDialog('Você tem alterações não salvas. Deseja sair mesmo assim?').then(function(ok){
        if(!ok) return;
        clearDirty();
        produtosFormView.hidden = true; produtosListView.hidden = false;
      });
      return;
    }
    produtosFormView.hidden = true; produtosListView.hidden = false;
  });
  document.getElementById('produto-cancel-btn').addEventListener('click', function(){
    document.getElementById('produto-back-btn').click();
  });

  produtoForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('produto-id').value;
    var name = document.getElementById('produto-name').value.trim();
    if(!name){ showToast('Informe o nome do produto.', true); return; }

    var mainUrls = produtoImages ? produtoImages.main.getUrls() : [];
    var body = {
      name: name,
      slug: document.getElementById('produto-slug').value.trim(),
      category: document.getElementById('produto-category').value,
      productType: document.getElementById('produto-type').value.trim(),
      volume: document.getElementById('produto-volume').value.trim(),
      sku: document.getElementById('produto-sku').value.trim(),
      price: document.getElementById('produto-price').value,
      salePrice: document.getElementById('produto-sale-price').value,
      stockQuantity: document.getElementById('produto-stock').value,
      trackStock: document.getElementById('produto-track-stock').checked,
      sortOrder: document.getElementById('produto-order').value,
      shortDescription: document.getElementById('produto-short-desc').value.trim(),
      description: document.getElementById('produto-desc').value.trim(),
      status: document.getElementById('produto-status').value,
      featured: document.getElementById('produto-featured').checked,
      clubExclusive: document.getElementById('produto-club-exclusive').checked,
      bestseller: document.getElementById('produto-bestseller').checked,
      limitedEdition: document.getElementById('produto-limited-edition').checked,
      mainImageUrl: mainUrls[0] || '',
      gallery: produtoImages ? produtoImages.gallery.getUrls() : [],
      concentration: document.getElementById('produto-concentration').value,
      olfactoryFamily: document.getElementById('produto-family').value.trim(),
      occasion: document.getElementById('produto-occasion').value.trim(),
      audience: document.getElementById('produto-audience').value.trim(),
      intensity: document.getElementById('produto-intensity').value.trim(),
      longevity: document.getElementById('produto-longevity').value.trim(),
      sillage: document.getElementById('produto-sillage').value.trim(),
      notesTop: document.getElementById('produto-notes-top').value.trim(),
      notesHeart: document.getElementById('produto-notes-heart').value.trim(),
      notesBase: document.getElementById('produto-notes-base').value.trim(),
      seoTitle: document.getElementById('produto-seo-title').value.trim(),
      seoDescription: document.getElementById('produto-seo-description').value.trim(),
      costEssence: document.getElementById('produto-cost-essence').value,
      costBase: document.getElementById('produto-cost-base').value,
      costBottle: document.getElementById('produto-cost-bottle').value,
      costCap: document.getElementById('produto-cost-cap').value,
      costLabel: document.getElementById('produto-cost-label').value,
      costPackaging: document.getElementById('produto-cost-packaging').value
    };

    var btn = produtoForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/products?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/products', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Produto atualizado.' : 'Produto criado.');
      produtosFormView.hidden = true; produtosListView.hidden = false;
      loadProductsList();
    }).catch(function(err){
      showToast(err.message || 'Não foi possível salvar o produto.', true);
    }).finally(function(){ setLoading(btn, false); });
  });

  document.getElementById('produto-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('produto-id').value;
    if(!id) return;
    confirmDialog('Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita.').then(function(ok){
      if(!ok) return;
      api('/api/admin/products?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty();
        showToast('Produto excluído.');
        produtosFormView.hidden = true; produtosListView.hidden = false;
        loadProductsList();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });

  loaders.produtos = function(){
    produtosFormView.hidden = true;
    produtosListView.hidden = false;
    loadCategoriesCache().then(loadProductsList);
  };

  /* ============================ Categorias ============================ */
  var categoriasListView = document.getElementById('categorias-list-view');
  var categoriasFormView = document.getElementById('categorias-form-view');
  var categoriaForm = document.getElementById('categoria-form');
  var categoriaImageUploader = null;
  attachSlugAutogen(document.getElementById('categoria-name'), document.getElementById('categoria-slug'));

  function loadCategoriasList(){
    var wrap = document.getElementById('categorias-table-wrap');
    clear(wrap);
    loadCategoriesCache().then(function(items){
      if(!items.length){
        wrap.appendChild(textEl('div', 'Nenhuma categoria cadastrada.', 'empty-state'));
        return;
      }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>Slug</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      items.forEach(function(c){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', c.name));
        tr.appendChild(textEl('td', c.slug));
        var statusTd = document.createElement('td');
        statusTd.appendChild(textEl('span', c.active ? 'Ativa' : 'Inativa', 'badge ' + (c.active ? 'badge-published' : 'badge-draft')));
        tr.appendChild(statusTd);
        var actionsTd = document.createElement('td');
        actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showCategoriaForm(c); });
        actionsTd.appendChild(editBtn);
        var toggleBtn = document.createElement('button'); toggleBtn.type = 'button'; toggleBtn.textContent = c.active ? 'Desativar' : 'Ativar';
        toggleBtn.addEventListener('click', function(){
          api('/api/admin/categories?id=' + c.id, { method: 'PUT', body: { active: !c.active } }).then(function(){
            showToast(c.active ? 'Categoria desativada.' : 'Categoria ativada.');
            loadCategoriasList();
          }).catch(function(err){ showToast(err.message, true); });
        });
        actionsTd.appendChild(toggleBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    });
  }

  function showCategoriaForm(cat){
    categoriasListView.hidden = true;
    categoriasFormView.hidden = false;
    categoriaForm.reset();
    document.getElementById('categoria-delete-btn').hidden = !cat;
    document.getElementById('categoria-form-title').textContent = cat ? 'Editar categoria' : 'Nova categoria';
    document.getElementById('categoria-id').value = cat ? cat.id : '';
    document.getElementById('categoria-name').value = cat ? cat.name : '';
    document.getElementById('categoria-slug').value = cat ? cat.slug : '';
    document.getElementById('categoria-description').value = cat ? (cat.description || '') : '';
    document.getElementById('categoria-active').checked = cat ? Boolean(cat.active) : true;
    var wrap = document.getElementById('categoria-image');
    categoriaImageUploader = createImageUploader(wrap, {
      urls: cat && cat.image_url ? [cat.image_url] : [], multiple: false, folder: 'categories', onChange: function(){}
    });
    watchDirty(categoriaForm);
  }
  document.getElementById('categoria-new-btn').addEventListener('click', function(){ showCategoriaForm(null); });
  document.getElementById('categoria-back-btn').addEventListener('click', function(){ categoriasFormView.hidden = true; categoriasListView.hidden = false; clearDirty(); });
  document.getElementById('categoria-cancel-btn').addEventListener('click', function(){ document.getElementById('categoria-back-btn').click(); });
  categoriaForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('categoria-id').value;
    var name = document.getElementById('categoria-name').value.trim();
    if(!name){ showToast('Informe o nome da categoria.', true); return; }
    var urls = categoriaImageUploader ? categoriaImageUploader.getUrls() : [];
    var body = {
      name: name,
      slug: document.getElementById('categoria-slug').value.trim(),
      description: document.getElementById('categoria-description').value.trim(),
      imageUrl: urls[0] || '',
      active: document.getElementById('categoria-active').checked
    };
    var btn = categoriaForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/categories?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/categories', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Categoria atualizada.' : 'Categoria criada.');
      categoriasFormView.hidden = true; categoriasListView.hidden = false;
      loadCategoriasList();
    }).catch(function(err){ showToast(err.message || 'Não foi possível salvar.', true); })
      .finally(function(){ setLoading(btn, false); });
  });
  document.getElementById('categoria-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('categoria-id').value;
    if(!id) return;
    confirmDialog('Tem certeza que deseja excluir esta categoria?').then(function(ok){
      if(!ok) return;
      api('/api/admin/categories?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty();
        showToast('Categoria excluída.');
        categoriasFormView.hidden = true; categoriasListView.hidden = false;
        loadCategoriasList();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });
  loaders.categorias = function(){
    categoriasFormView.hidden = true; categoriasListView.hidden = false;
    loadCategoriasList();
  };

  /* ============================ Movimentação de estoque (modal genérico) ============================ */
  var movementModal = document.getElementById('movement-modal');
  var movementForm = document.getElementById('movement-form');
  var movementModalTitle = document.getElementById('movement-modal-title');
  var movementQuantityInput = document.getElementById('movement-quantity');
  var movementReasonInput = document.getElementById('movement-reason');
  var movementContext = null;

  function openMovementModal(itemType, itemId, itemName, direction, onDone){
    movementContext = { itemType: itemType, itemId: itemId, direction: direction, onDone: onDone };
    movementModalTitle.textContent = (direction === 'entrada' ? 'Adicionar estoque — ' : 'Retirar estoque — ') + itemName;
    movementForm.reset();
    movementModal.hidden = false;
    movementQuantityInput.focus();
  }
  function closeMovementModal(){ movementModal.hidden = true; movementContext = null; }
  document.getElementById('movement-cancel-btn').addEventListener('click', closeMovementModal);
  movementModal.addEventListener('click', function(e){ if(e.target === movementModal) closeMovementModal(); });
  movementForm.addEventListener('submit', function(e){
    e.preventDefault();
    if(!movementContext) return;
    var qty = Number(movementQuantityInput.value);
    if(!(qty > 0)){ showToast('Informe uma quantidade válida.', true); return; }
    var btn = movementForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/stock-movements', {
      method: 'POST',
      body: {
        itemType: movementContext.itemType,
        itemId: movementContext.itemId,
        direction: movementContext.direction,
        quantity: qty,
        reason: movementReasonInput.value.trim()
      }
    }).then(function(){
      showToast('Movimentação registrada.');
      var onDone = movementContext.onDone;
      closeMovementModal();
      if(onDone) onDone();
    }).catch(function(err){ showToast(err.message || 'Não foi possível registrar.', true); })
      .finally(function(){ setLoading(btn, false); });
  });

  /* ============================ Estoque ============================ */
  var estoqueListView = document.getElementById('estoque-list-view');
  var estoqueFormView = document.getElementById('estoque-form-view');
  var estoqueMovView = document.getElementById('estoque-movimentacoes-view');
  var estoqueForm = document.getElementById('estoque-form');
  var estoqueState = { tab: 'materia_prima' };

  function alertBadgeHtml(level){
    return '<span class="badge badge-alert-' + level + '">' + (ALERT_LABELS[level] || level) + '</span>';
  }
  function subtypeLabel(type, subtype){
    var found = '';
    (INVENTORY_SUBTYPES[type] || []).forEach(function(pair){ if(pair[0] === subtype) found = pair[1]; });
    return found;
  }
  function populateEstoqueSubtypes(type){
    var select = document.getElementById('estoque-subtype');
    clear(select);
    (INVENTORY_SUBTYPES[type] || []).forEach(function(pair){
      var opt = document.createElement('option');
      opt.value = pair[0]; opt.textContent = pair[1];
      select.appendChild(opt);
    });
  }
  function showEstoqueList(){
    estoqueFormView.hidden = true; estoqueMovView.hidden = true; estoqueListView.hidden = false;
  }

  function loadEstoqueTab(){
    var wrap = document.getElementById('estoque-table-wrap');
    clear(wrap);

    if(estoqueState.tab === 'produtos'){
      api('/api/admin/products').then(function(data){
        var items = data.products.filter(function(p){ return p.track_stock; });
        if(!items.length){ wrap.appendChild(textEl('div', 'Nenhum produto com controle de estoque.', 'empty-state')); return; }
        var table = document.createElement('table');
        table.className = 'admin-table';
        table.innerHTML = '<thead><tr><th>Nome</th><th>Quantidade</th><th>Custo unitário</th><th>Valor total</th><th>Última atualização</th><th></th></tr></thead>';
        var tbody = document.createElement('tbody');
        items.forEach(function(p){
          var unitCost = Number(p.cost_essence||0) + Number(p.cost_base||0) + Number(p.cost_bottle||0) + Number(p.cost_cap||0) + Number(p.cost_label||0) + Number(p.cost_packaging||0);
          var tr = document.createElement('tr');
          tr.appendChild(textEl('td', p.name));
          tr.appendChild(textEl('td', p.stock_quantity + ' un.'));
          tr.appendChild(textEl('td', formatMoney(unitCost)));
          tr.appendChild(textEl('td', formatMoney(unitCost * p.stock_quantity)));
          tr.appendChild(textEl('td', formatDate(p.updated_at)));
          var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
          var inBtn = document.createElement('button'); inBtn.type = 'button'; inBtn.textContent = '+ Entrada';
          inBtn.addEventListener('click', function(){ openMovementModal('product', p.id, p.name, 'entrada', loadEstoqueTab); });
          var outBtn = document.createElement('button'); outBtn.type = 'button'; outBtn.textContent = '- Saída';
          outBtn.addEventListener('click', function(){ openMovementModal('product', p.id, p.name, 'saida', loadEstoqueTab); });
          actionsTd.appendChild(inBtn); actionsTd.appendChild(outBtn);
          tr.appendChild(actionsTd);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody); wrap.appendChild(table);
      }).catch(function(err){ showToast(err.message, true); });
      return;
    }

    api('/api/admin/inventory?type=' + estoqueState.tab).then(function(data){
      if(!data.items.length){ wrap.appendChild(textEl('div', 'Nenhum item cadastrado nesta categoria ainda.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>Subtipo</th><th>Quantidade</th><th>Custo unitário</th><th>Valor total</th><th>Alerta</th><th>Atualizado</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(item){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', item.name));
        tr.appendChild(textEl('td', subtypeLabel(item.type, item.subtype) || item.subtype || '—'));
        tr.appendChild(textEl('td', Number(item.quantity) + ' ' + item.unit));
        tr.appendChild(textEl('td', formatMoney(item.unit_cost)));
        tr.appendChild(textEl('td', formatMoney(Number(item.quantity) * Number(item.unit_cost))));
        var alertTd = document.createElement('td'); alertTd.innerHTML = alertBadgeHtml(item.alert_level); tr.appendChild(alertTd);
        tr.appendChild(textEl('td', formatDate(item.updated_at)));

        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var inBtn = document.createElement('button'); inBtn.type = 'button'; inBtn.textContent = '+ Entrada';
        inBtn.addEventListener('click', function(){ openMovementModal('inventory', item.id, item.name, 'entrada', loadEstoqueTab); });
        actionsTd.appendChild(inBtn);
        var outBtn = document.createElement('button'); outBtn.type = 'button'; outBtn.textContent = '- Saída';
        outBtn.addEventListener('click', function(){ openMovementModal('inventory', item.id, item.name, 'saida', loadEstoqueTab); });
        actionsTd.appendChild(outBtn);
        var histBtn = document.createElement('button'); histBtn.type = 'button'; histBtn.textContent = 'Histórico';
        histBtn.addEventListener('click', function(){ showEstoqueMovimentacoes('inventory', item.id, item.name); });
        actionsTd.appendChild(histBtn);
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showEstoqueForm(item); });
        actionsTd.appendChild(editBtn);
        var delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.textContent = 'Excluir';
        delBtn.addEventListener('click', function(){
          confirmDialog('Tem certeza que deseja excluir "' + item.name + '"?').then(function(ok){
            if(!ok) return;
            api('/api/admin/inventory?id=' + item.id, { method: 'DELETE' }).then(function(){
              showToast('Item excluído.'); loadEstoqueTab();
            }).catch(function(err){ showToast(err.message, true); });
          });
        });
        actionsTd.appendChild(delBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }

  document.querySelectorAll('#estoque-tabs .tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#estoque-tabs .tab-btn').forEach(function(b){ b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      estoqueState.tab = btn.getAttribute('data-estoque-tab');
      loadEstoqueTab();
    });
  });

  function showEstoqueForm(item){
    estoqueListView.hidden = true; estoqueMovView.hidden = true; estoqueFormView.hidden = false;
    estoqueForm.reset();
    document.getElementById('estoque-form-title').textContent = item ? 'Editar item' : 'Novo item';
    document.getElementById('estoque-delete-btn').hidden = !item;
    document.getElementById('estoque-id').value = item ? item.id : '';
    var type = item ? item.type : (estoqueState.tab !== 'produtos' ? estoqueState.tab : 'materia_prima');
    document.getElementById('estoque-type').value = type;
    populateEstoqueSubtypes(type);
    document.getElementById('estoque-name').value = item ? item.name : '';
    if(item) document.getElementById('estoque-subtype').value = item.subtype || '';
    document.getElementById('estoque-unit').value = item ? item.unit : (type === 'materia_prima' ? 'ml' : 'un');
    document.getElementById('estoque-quantity').value = item ? item.quantity : 0;
    document.getElementById('estoque-unit-cost').value = item ? item.unit_cost : 0;
    document.getElementById('estoque-min').value = item ? item.min_threshold : 0;
    document.getElementById('estoque-notes').value = item ? (item.notes || '') : '';
    watchDirty(estoqueForm);
  }
  document.getElementById('estoque-new-btn').addEventListener('click', function(){ showEstoqueForm(null); });
  document.getElementById('estoque-form-back-btn').addEventListener('click', function(){ clearDirty(); showEstoqueList(); });
  document.getElementById('estoque-cancel-btn').addEventListener('click', function(){ document.getElementById('estoque-form-back-btn').click(); });

  estoqueForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('estoque-id').value;
    var name = document.getElementById('estoque-name').value.trim();
    if(!name){ showToast('Informe o nome do item.', true); return; }
    var body = {
      type: document.getElementById('estoque-type').value,
      subtype: document.getElementById('estoque-subtype').value,
      name: name,
      unit: document.getElementById('estoque-unit').value,
      quantity: document.getElementById('estoque-quantity').value,
      unitCost: document.getElementById('estoque-unit-cost').value,
      minThreshold: document.getElementById('estoque-min').value,
      notes: document.getElementById('estoque-notes').value.trim()
    };
    var btn = estoqueForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/inventory?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/inventory', { method: 'POST', body: body });
    req.then(function(data){
      clearDirty();
      showToast(id ? 'Item atualizado.' : 'Item criado.');
      estoqueState.tab = data.item.type;
      document.querySelectorAll('#estoque-tabs .tab-btn').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-estoque-tab') === data.item.type); });
      showEstoqueList();
      loadEstoqueTab();
    }).catch(function(err){ showToast(err.message || 'Não foi possível salvar.', true); })
      .finally(function(){ setLoading(btn, false); });
  });
  document.getElementById('estoque-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('estoque-id').value;
    if(!id) return;
    confirmDialog('Tem certeza que deseja excluir este item?').then(function(ok){
      if(!ok) return;
      api('/api/admin/inventory?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty(); showToast('Item excluído.'); showEstoqueList(); loadEstoqueTab();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });

  function showEstoqueMovimentacoes(itemType, itemId, itemName){
    estoqueListView.hidden = true; estoqueFormView.hidden = true; estoqueMovView.hidden = false;
    document.getElementById('estoque-mov-item-name').textContent = itemName;
    document.getElementById('estoque-mov-entrada-btn').onclick = function(){
      openMovementModal(itemType, itemId, itemName, 'entrada', function(){ loadMovimentacoes(itemType, itemId); });
    };
    document.getElementById('estoque-mov-saida-btn').onclick = function(){
      openMovementModal(itemType, itemId, itemName, 'saida', function(){ loadMovimentacoes(itemType, itemId); });
    };
    loadMovimentacoes(itemType, itemId);
  }
  function loadMovimentacoes(itemType, itemId){
    var wrap = document.getElementById('estoque-mov-table-wrap');
    clear(wrap);
    api('/api/admin/stock-movements?itemType=' + itemType + '&itemId=' + itemId).then(function(data){
      if(!data.movements.length){ wrap.appendChild(textEl('div', 'Nenhuma movimentação registrada ainda.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Data</th><th>Tipo</th><th>Quantidade</th><th>Estoque anterior</th><th>Estoque atual</th><th>Motivo</th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.movements.forEach(function(m){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', formatDate(m.created_at)));
        var typeTd = document.createElement('td');
        typeTd.appendChild(textEl('span', m.direction === 'entrada' ? 'Entrada' : 'Saída', 'badge ' + (m.direction === 'entrada' ? 'badge-published' : 'badge-novo')));
        tr.appendChild(typeTd);
        tr.appendChild(textEl('td', String(m.quantity)));
        tr.appendChild(textEl('td', String(m.previous_stock)));
        tr.appendChild(textEl('td', String(m.new_stock)));
        tr.appendChild(textEl('td', m.reason || '—'));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('estoque-mov-back-btn').addEventListener('click', showEstoqueList);

  loaders.estoque = function(){
    showEstoqueList();
    loadEstoqueTab();
  };

  /* ============================ Produção ============================ */
  var producaoListView = document.getElementById('producao-list-view');
  var producaoFormView = document.getElementById('producao-form-view');
  var producaoDetailView = document.getElementById('producao-detail-view');
  var producaoForm = document.getElementById('producao-form');
  var producaoState = { search: '', status: '' };
  var producaoIngredientRows = [];

  function showProducaoList(){ producaoFormView.hidden = true; producaoDetailView.hidden = true; producaoListView.hidden = false; }

  function loadProducaoList(){
    var wrap = document.getElementById('producao-table-wrap');
    clear(wrap);
    var qs = [];
    if(producaoState.search) qs.push('q=' + encodeURIComponent(producaoState.search));
    if(producaoState.status) qs.push('status=' + encodeURIComponent(producaoState.status));
    api('/api/admin/production' + (qs.length ? '?' + qs.join('&') : '')).then(function(data){
      if(!data.batches.length){ wrap.appendChild(textEl('div', 'Nenhum lote de produção registrado ainda.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Lote</th><th>Perfume</th><th>Data</th><th>Frascos</th><th>Custo</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.batches.forEach(function(b){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', b.lote_code, 'lote-code'));
        tr.appendChild(textEl('td', b.perfume_name));
        tr.appendChild(textEl('td', formatDate(b.production_date)));
        tr.appendChild(textEl('td', String(b.bottle_count)));
        tr.appendChild(textEl('td', formatMoney(b.production_cost)));
        var statusTd = document.createElement('td');
        var statusBadgeClass = b.status === 'pronto' ? 'badge-published' : b.status === 'esgotado' ? 'badge-archived' : 'badge-draft';
        statusTd.appendChild(textEl('span', BATCH_STATUS_LABELS[b.status] || b.status, 'badge ' + statusBadgeClass));
        tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var viewBtn = document.createElement('button'); viewBtn.type = 'button'; viewBtn.textContent = 'Ver lote';
        viewBtn.addEventListener('click', function(){ showProducaoDetail(b.id); });
        actionsTd.appendChild(viewBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }

  var producaoSearchTimer = null;
  document.getElementById('producao-search').addEventListener('input', function(){
    var input = this;
    window.clearTimeout(producaoSearchTimer);
    producaoSearchTimer = window.setTimeout(function(){
      producaoState.search = input.value.trim();
      loadProducaoList();
    }, 300);
  });
  document.getElementById('producao-status-filter').addEventListener('change', function(){
    producaoState.status = this.value;
    loadProducaoList();
  });

  function loadProductsSelect(selectEl){
    return api('/api/admin/products').then(function(data){
      clear(selectEl);
      var placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = 'Selecionar perfume…';
      selectEl.appendChild(placeholder);
      data.products.forEach(function(p){
        var opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        selectEl.appendChild(opt);
      });
    });
  }
  function loadInventorySelect(selectEl, type, placeholderText){
    return api('/api/admin/inventory?type=' + type).then(function(data){
      clear(selectEl);
      var placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = placeholderText;
      selectEl.appendChild(placeholder);
      data.items.forEach(function(item){
        var opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name + ' (' + item.quantity + ' ' + item.unit + ' em estoque)';
        opt.setAttribute('data-unit-cost', item.unit_cost);
        selectEl.appendChild(opt);
      });
    });
  }

  function renderIngredientRows(){
    var wrap = document.getElementById('producao-ingredients-list');
    clear(wrap);
    producaoIngredientRows.forEach(function(row, idx){
      var rowEl = document.createElement('div');
      rowEl.className = 'ingredient-row';

      var nameField = document.createElement('div'); nameField.className = 'field';
      var nameInput = document.createElement('input');
      nameInput.placeholder = 'Nome do ingrediente'; nameInput.value = row.name || '';
      nameInput.addEventListener('input', function(){ row.name = nameInput.value; });
      nameField.appendChild(nameInput);

      var qtyField = document.createElement('div'); qtyField.className = 'field';
      var qtyInput = document.createElement('input');
      qtyInput.type = 'number'; qtyInput.min = '0'; qtyInput.step = '0.01'; qtyInput.placeholder = 'Quantidade (ml)';
      qtyInput.value = row.qty || 0;
      qtyInput.addEventListener('input', function(){ row.qty = Number(qtyInput.value) || 0; recalcProducao(); });
      qtyField.appendChild(qtyInput);

      var costField = document.createElement('div'); costField.className = 'field';
      var costInput = document.createElement('input');
      costInput.type = 'number'; costInput.min = '0'; costInput.step = '0.01'; costInput.placeholder = 'Custo unit. (R$)';
      costInput.value = row.unitCost || 0;
      costInput.addEventListener('input', function(){ row.unitCost = Number(costInput.value) || 0; recalcProducao(); });
      costField.appendChild(costInput);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button'; removeBtn.className = 'ingredient-remove-btn'; removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', 'Remover ingrediente');
      removeBtn.addEventListener('click', function(){
        producaoIngredientRows.splice(idx, 1);
        renderIngredientRows(); recalcProducao();
      });

      rowEl.appendChild(nameField); rowEl.appendChild(qtyField); rowEl.appendChild(costField); rowEl.appendChild(removeBtn);
      wrap.appendChild(rowEl);
    });
  }
  document.getElementById('producao-ingredient-add-btn').addEventListener('click', function(){
    producaoIngredientRows.push({ name: '', qty: 0, unitCost: 0 });
    renderIngredientRows();
  });

  function recalcProducao(){
    var essenceMl = Number(document.getElementById('producao-essence-ml').value) || 0;
    var baseMl = Number(document.getElementById('producao-base-ml').value) || 0;
    var otherMl = producaoIngredientRows.reduce(function(s, r){ return s + (Number(r.qty) || 0); }, 0);
    var totalVolumeInput = document.getElementById('producao-total-volume');
    if(totalVolumeInput.dataset.auto !== 'false'){
      totalVolumeInput.value = (essenceMl + baseMl + otherMl) || '';
      totalVolumeInput.dataset.auto = 'true';
    }
    var totalVolume = Number(totalVolumeInput.value) || 0;
    var bottleSize = Number(document.getElementById('producao-bottle-size').value) || 0;
    var bottleCount = bottleSize > 0 ? Math.floor(totalVolume / bottleSize) : 0;
    document.getElementById('producao-bottle-count').value = bottleCount;

    var essenceSelect = document.getElementById('producao-essence-item');
    var baseSelect = document.getElementById('producao-base-item');
    var bottleSelect = document.getElementById('producao-bottle-item');
    var essenceCost = essenceSelect.selectedOptions[0] ? Number(essenceSelect.selectedOptions[0].getAttribute('data-unit-cost') || 0) * essenceMl : 0;
    var baseCost = baseSelect.selectedOptions[0] ? Number(baseSelect.selectedOptions[0].getAttribute('data-unit-cost') || 0) * baseMl : 0;
    var bottleCost = bottleSelect.selectedOptions[0] ? Number(bottleSelect.selectedOptions[0].getAttribute('data-unit-cost') || 0) * bottleCount : 0;
    var otherCost = producaoIngredientRows.reduce(function(s, r){ return s + (Number(r.qty) || 0) * (Number(r.unitCost) || 0); }, 0);
    var totalCost = essenceCost + baseCost + bottleCost + otherCost;

    var costInput = document.getElementById('producao-cost');
    if(costInput.dataset.touched !== 'true'){
      costInput.value = totalCost ? totalCost.toFixed(2) : '';
    }
  }
  ['producao-essence-ml', 'producao-base-ml', 'producao-bottle-size', 'producao-essence-item', 'producao-base-item', 'producao-bottle-item'].forEach(function(id){
    document.getElementById(id).addEventListener('input', recalcProducao);
    document.getElementById(id).addEventListener('change', recalcProducao);
  });
  document.getElementById('producao-total-volume').addEventListener('input', function(){
    this.dataset.auto = 'false';
    recalcProducao();
  });
  document.getElementById('producao-cost').addEventListener('input', function(){ this.dataset.touched = 'true'; });

  function showProducaoForm(){
    producaoListView.hidden = true; producaoDetailView.hidden = true; producaoFormView.hidden = false;
    producaoForm.reset();
    producaoIngredientRows = [];
    renderIngredientRows();
    document.getElementById('producao-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('producao-bottle-count').value = 0;
    document.getElementById('producao-cost').removeAttribute('data-touched');
    document.getElementById('producao-total-volume').removeAttribute('data-auto');
    Promise.all([
      loadProductsSelect(document.getElementById('producao-product')),
      loadInventorySelect(document.getElementById('producao-essence-item'), 'materia_prima', 'Selecionar item do estoque…'),
      loadInventorySelect(document.getElementById('producao-base-item'), 'materia_prima', 'Selecionar item do estoque…'),
      loadInventorySelect(document.getElementById('producao-bottle-item'), 'frasco', 'Selecionar frasco do estoque…')
    ]).then(function(){ recalcProducao(); });
    watchDirty(producaoForm);
  }
  document.getElementById('producao-new-btn').addEventListener('click', showProducaoForm);
  document.getElementById('producao-back-btn').addEventListener('click', function(){
    if(dirtyGuard.active){
      confirmDialog('Você tem alterações não salvas. Deseja sair mesmo assim?').then(function(ok){
        if(!ok) return; clearDirty(); showProducaoList();
      });
      return;
    }
    showProducaoList();
  });
  document.getElementById('producao-cancel-btn').addEventListener('click', function(){ document.getElementById('producao-back-btn').click(); });

  producaoForm.addEventListener('submit', function(e){
    e.preventDefault();
    var productId = document.getElementById('producao-product').value;
    if(!productId){ showToast('Selecione o perfume.', true); return; }
    var body = {
      productId: Number(productId),
      productionDate: document.getElementById('producao-date').value,
      essenceItemId: document.getElementById('producao-essence-item').value || null,
      essenceMl: document.getElementById('producao-essence-ml').value,
      baseItemId: document.getElementById('producao-base-item').value || null,
      baseMl: document.getElementById('producao-base-ml').value,
      otherIngredients: producaoIngredientRows.filter(function(r){ return r.name; }),
      totalVolumeMl: document.getElementById('producao-total-volume').value,
      bottleItemId: document.getElementById('producao-bottle-item').value || null,
      bottleSizeMl: document.getElementById('producao-bottle-size').value,
      productionCost: document.getElementById('producao-cost').value,
      status: document.getElementById('producao-status').value,
      notes: document.getElementById('producao-notes').value.trim()
    };
    var btn = producaoForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/production', { method: 'POST', body: body }).then(function(data){
      clearDirty();
      showToast('Lote "' + data.batch.lote_code + '" registrado.');
      showProducaoList();
      loadProducaoList();
    }).catch(function(err){ showToast(err.message || 'Não foi possível registrar a produção.', true); })
      .finally(function(){ setLoading(btn, false); });
  });

  function showProducaoDetail(id){
    producaoListView.hidden = true; producaoFormView.hidden = true; producaoDetailView.hidden = false;
    var body = document.getElementById('producao-detail-body');
    clear(body);
    api('/api/admin/production?id=' + id).then(function(data){
      var b = data.batch;
      document.getElementById('producao-detail-title').innerHTML = '<span class="lote-code">' + b.lote_code + '</span> — ' + b.perfume_name;

      var grid = document.createElement('div'); grid.className = 'batch-detail-grid';
      function addItem(label, value){
        var el = document.createElement('div'); el.className = 'batch-detail-item';
        el.appendChild(textEl('div', label, 'label'));
        el.appendChild(textEl('div', value, 'value'));
        grid.appendChild(el);
      }
      addItem('Data de produção', formatDate(b.production_date));
      addItem('Essência', (b.essence_name || '—') + ' · ' + b.essence_ml + ' ml');
      addItem('Álcool/Base', (b.base_name || '—') + ' · ' + b.base_ml + ' ml');
      addItem('Volume total', b.total_volume_ml + ' ml');
      addItem('Frasco', (b.bottle_name || '—') + ' · ' + b.bottle_size_ml + ' ml cada');
      addItem('Frascos produzidos', String(b.bottle_count));
      addItem('Custo da produção', formatMoney(b.production_cost));
      body.appendChild(grid);

      if(b.other_ingredients && b.other_ingredients.length){
        body.appendChild(textEl('h2', 'Outros ingredientes', 'dashboard-activity-title'));
        var table = document.createElement('table'); table.className = 'admin-table';
        table.innerHTML = '<thead><tr><th>Ingrediente</th><th>Quantidade</th><th>Custo unitário</th></tr></thead>';
        var tbody = document.createElement('tbody');
        b.other_ingredients.forEach(function(ing){
          var tr = document.createElement('tr');
          tr.appendChild(textEl('td', ing.name));
          tr.appendChild(textEl('td', ing.qty + ' ml'));
          tr.appendChild(textEl('td', formatMoney(ing.unitCost)));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        var tableWrap = document.createElement('div'); tableWrap.className = 'table-wrap'; tableWrap.appendChild(table);
        body.appendChild(tableWrap);
      }

      if(b.notes){
        body.appendChild(textEl('h2', 'Observações', 'dashboard-activity-title'));
        body.appendChild(textEl('p', b.notes));
      }

      body.appendChild(textEl('h2', 'Status do lote', 'dashboard-activity-title'));
      var statusWrap = document.createElement('div'); statusWrap.className = 'toolbar-actions';
      var select = document.createElement('select'); select.className = 'batch-status-select';
      ['produzindo', 'macerando', 'pronto', 'esgotado'].forEach(function(s){
        var opt = document.createElement('option'); opt.value = s; opt.textContent = BATCH_STATUS_LABELS[s];
        if(s === b.status) opt.selected = true;
        select.appendChild(opt);
      });
      var saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'btn-primary'; saveBtn.textContent = 'Atualizar status';
      saveBtn.addEventListener('click', function(){
        api('/api/admin/production?id=' + b.id, { method: 'PUT', body: { status: select.value } }).then(function(){
          showToast('Status do lote atualizado.');
          showProducaoDetail(b.id);
          loadProducaoList();
        }).catch(function(err){ showToast(err.message, true); });
      });
      statusWrap.appendChild(select); statusWrap.appendChild(saveBtn);
      body.appendChild(statusWrap);
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('producao-detail-back-btn').addEventListener('click', showProducaoList);

  loaders.producao = function(){
    showProducaoList();
    loadProducaoList();
  };

  /* ============================ Financeiro ============================ */
  loaders.financeiro = function(){
    var wrap = document.getElementById('financeiro-table-wrap');
    clear(wrap);
    api('/api/admin/products').then(function(data){
      var products = data.products;
      if(!products.length){ wrap.appendChild(textEl('div', 'Nenhum produto cadastrado ainda.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Perfume</th><th>Custo total</th><th>Preço de venda</th><th>Lucro por unidade</th><th>Margem</th></tr></thead>';
      var tbody = document.createElement('tbody');
      products.forEach(function(p){
        var cost = Number(p.cost_essence||0) + Number(p.cost_base||0) + Number(p.cost_bottle||0) + Number(p.cost_cap||0) + Number(p.cost_label||0) + Number(p.cost_packaging||0);
        var price = p.sale_price != null ? Number(p.sale_price) : (p.price != null ? Number(p.price) : null);
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', p.name));
        tr.appendChild(textEl('td', formatMoney(cost)));
        tr.appendChild(textEl('td', price != null ? formatMoney(price) : '—'));
        if(price != null){
          var profit = price - cost;
          var margin = price > 0 ? (profit / price * 100) : 0;
          tr.appendChild(textEl('td', formatMoney(profit), profit >= 0 ? 'profit-positive' : 'profit-negative'));
          tr.appendChild(textEl('td', margin.toFixed(1) + '%', profit >= 0 ? 'profit-positive' : 'profit-negative'));
        } else {
          tr.appendChild(textEl('td', '—'));
          tr.appendChild(textEl('td', '—'));
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  };

  /* ============================ Pedidos ============================ */
  loaders.pedidos = function(){
    var wrap = document.getElementById('pedidos-table-wrap');
    clear(wrap);
    api('/api/admin/orders').then(function(data){
      if(!data.items.length){
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.appendChild(textEl('p', 'Nenhum pedido ainda.', 'empty-title'));
        wrap.appendChild(empty);
        return;
      }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Número</th><th>Cliente</th><th>Data</th><th>Total</th><th>Pagamento</th><th>Status</th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(o){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', o.order_number));
        tr.appendChild(textEl('td', o.customer_name));
        tr.appendChild(textEl('td', formatDate(o.created_at)));
        tr.appendChild(textEl('td', formatMoney(o.total)));
        tr.appendChild(textEl('td', o.payment_method || '—'));
        var statusTd = document.createElement('td');
        statusTd.appendChild(textEl('span', ORDER_STATUS_LABELS[o.status] || o.status, 'badge badge-draft'));
        tr.appendChild(statusTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  };

  /* ============================ Clientes ============================ */
  var clientesState = { search: '' };
  function loadClientes(){
    var wrap = document.getElementById('clientes-table-wrap');
    clear(wrap);
    var qs = clientesState.search ? '?search=' + encodeURIComponent(clientesState.search) : '';
    api('/api/admin/customers' + qs).then(function(data){
      if(!data.items.length){
        wrap.appendChild(textEl('div', clientesState.search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente ainda.', 'empty-state'));
        return;
      }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Pedidos</th><th>Total gasto</th><th>Último pedido</th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(c){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', c.name));
        tr.appendChild(textEl('td', c.email));
        tr.appendChild(textEl('td', String(c.orders_count)));
        tr.appendChild(textEl('td', formatMoney(c.total_spent)));
        tr.appendChild(textEl('td', formatDate(c.last_order_at)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  var clientesSearchTimer = null;
  document.getElementById('clientes-search').addEventListener('input', function(e){
    window.clearTimeout(clientesSearchTimer);
    clientesSearchTimer = window.setTimeout(function(){ clientesState.search = e.target.value.trim(); loadClientes(); }, 300);
  });
  loaders.clientes = function(){
    clientesState.search = '';
    document.getElementById('clientes-search').value = '';
    loadClientes();
  };

  /* ============================ Clube Verité ============================ */
  var CLUB_STATUS_LABELS = { ativo: 'Ativo', utilizado: 'Utilizado', bloqueado: 'Bloqueado' };
  var CLUB_STATUS_BADGES = { ativo: 'badge-published', utilizado: 'badge-neutral', bloqueado: 'badge-novo' };

  /* ---- Sub-abas principais ---- */
  document.querySelectorAll('#clube-subtabs .tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#clube-subtabs .tab-btn').forEach(function(b){ b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var tab = btn.getAttribute('data-clube-tab');
      document.querySelectorAll('[data-clube-panel]').forEach(function(p){
        p.hidden = p.getAttribute('data-clube-panel') !== tab;
      });
      if (tab === 'membros') loadClubeMembros();
      else if (tab === 'codigos') loadClube();
      else if (tab === 'niveis') loadClubeNiveis();
      else if (tab === 'beneficios') { populateClubeTierSelect(document.getElementById('clube-beneficio-tier')); loadClubeBeneficios(); }
      else if (tab === 'pontos') { loadClubeRegras(); loadClubeRecompensas(); populateClubeMemberSelect(document.getElementById('clube-ajuste-membro')); }
      else if (tab === 'cupons') loadClubeCupons();
      else if (tab === 'presentes') loadClubePresentes();
      else if (tab === 'novidades') loadClubeNovidades();
    });
  });

  /* ---- Sub-abas de Pontos ---- */
  document.querySelectorAll('#clube-pontos-subtabs .tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#clube-pontos-subtabs .tab-btn').forEach(function(b){ b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var tab = btn.getAttribute('data-clube-pontos-tab');
      document.querySelectorAll('[data-clube-pontos-panel]').forEach(function(p){
        p.hidden = p.getAttribute('data-clube-pontos-panel') !== tab;
      });
    });
  });

  function clubeBadge(active){
    return textEl('span', active ? 'Ativo' : 'Inativo', 'badge ' + (active ? 'badge-published' : 'badge-draft'));
  }

  var clubeTierCache = [];
  function populateClubeTierSelect(select){
    if (!select) return Promise.resolve();
    return api('/api/admin/club-tiers').then(function(data){
      clubeTierCache = data.items;
      var current = select.value;
      clear(select);
      select.appendChild(new Option('Todos os níveis', ''));
      data.items.forEach(function(t){ select.appendChild(new Option(t.name, t.id)); });
      if (current) select.value = current;
    }).catch(function(){});
  }

  var clubeMemberCache = [];
  function populateClubeMemberSelect(select){
    if (!select) return Promise.resolve();
    return api('/api/admin/club-members').then(function(data){
      clubeMemberCache = data.items;
      var current = select.value;
      clear(select);
      select.appendChild(new Option('Selecionar membro…', ''));
      data.items.forEach(function(m){ select.appendChild(new Option(m.name + ' — ' + m.email, m.id)); });
      if (current) select.value = current;
    }).catch(function(){});
  }

  /* ---- Membros ---- */
  var clubeMembrosListView = document.getElementById('clube-membros-list-view');
  var clubeMembrosDetailView = document.getElementById('clube-membros-detail-view');
  var clubeMembrosSearchTimer = null;

  function loadClubeMembros(){
    var wrap = document.getElementById('clube-membros-table-wrap');
    clear(wrap);
    var search = document.getElementById('clube-membros-search').value.trim();
    api('/api/admin/club-members?search=' + encodeURIComponent(search)).then(function(data){
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhum membro encontrado.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>Tipo de usuário</th><th>Número</th><th>E-mail</th><th>Nível</th><th>Pontos</th><th>Compras</th><th>Entrada</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(m){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', m.name));
        var typeTd = document.createElement('td');
        typeTd.appendChild(textEl('span', m.membershipType === 'membro_verite' ? 'Membro Verité' : 'Iniciante', 'badge ' + (m.membershipType === 'membro_verite' ? 'badge-published' : 'badge-neutral')));
        tr.appendChild(typeTd);
        tr.appendChild(textEl('td', m.member_number || '—'));
        tr.appendChild(textEl('td', m.email));
        tr.appendChild(textEl('td', m.membershipType === 'membro_verite' ? (m.tierName || '—') : '—'));
        tr.appendChild(textEl('td', String(m.pointsBalance)));
        tr.appendChild(textEl('td', String(m.orders_count || 0)));
        tr.appendChild(textEl('td', m.club_joined_at ? formatDate(m.club_joined_at) : '—'));
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var viewBtn = document.createElement('button'); viewBtn.type = 'button'; viewBtn.textContent = 'Ver perfil';
        viewBtn.addEventListener('click', function(){ showClubeMembroDetail(m.id); });
        actionsTd.appendChild(viewBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('clube-membros-search').addEventListener('input', function(){
    window.clearTimeout(clubeMembrosSearchTimer);
    clubeMembrosSearchTimer = window.setTimeout(loadClubeMembros, 300);
  });

  function clubeMiniTable(headers, rows){
    if (!rows.length) return textEl('p', 'Nenhum registro ainda.', 'empty-state-mini');
    var table = document.createElement('table');
    table.className = 'admin-table';
    var thead = document.createElement('tr');
    headers.forEach(function(h){ thead.appendChild(textEl('th', h)); });
    var theadWrap = document.createElement('thead'); theadWrap.appendChild(thead);
    table.appendChild(theadWrap);
    var tbody = document.createElement('tbody');
    rows.forEach(function(cells){
      var tr = document.createElement('tr');
      cells.forEach(function(c){ tr.appendChild(textEl('td', c)); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function showClubeMembroDetail(id){
    clubeMembrosListView.hidden = true; clubeMembrosDetailView.hidden = false;
    var body = document.getElementById('clube-membro-detail-body');
    clear(body);
    body.appendChild(textEl('p', 'Carregando…', 'empty-state'));
    api('/api/admin/club-members?id=' + id).then(function(data){
      clear(body);
      var m = data.member;
      document.getElementById('clube-membro-detail-name').textContent = m.name;

      var infoGrid = document.createElement('div');
      infoGrid.className = 'form-grid';
      var isMembro = data.membershipType === 'membro_verite';
      [
        ['Tipo de usuário', isMembro ? 'Membro Verité' : 'Iniciante'],
        ['E-mail', m.email], ['Telefone', m.phone || '—'], ['Número de membro', m.member_number || '—'],
        ['Código Verité', data.code ? data.code.code : '—'],
        ['Ativado em', data.code && data.code.activated_at ? formatDate(data.code.activated_at) : '—'],
        ['Nível atual', isMembro ? (data.tier ? data.tier.name : '—') : '— (ainda não é Membro Verité)'],
        ['Pontos', String(data.points.balance)],
        ['Compras realizadas', String(m.orders_count || 0)], ['Total gasto', formatMoney(m.total_spent)],
        ['Membro desde', m.club_joined_at ? formatDate(m.club_joined_at) : '—'],
        ['Aniversário', m.birthday ? formatDate(m.birthday) : '—'],
      ].forEach(function(pair){
        var f = document.createElement('div'); f.className = 'field';
        f.appendChild(textEl('label', pair[0]));
        f.appendChild(textEl('p', pair[1]));
        infoGrid.appendChild(f);
      });
      body.appendChild(infoGrid);

      body.appendChild(textEl('h2', 'Histórico de pontos'));
      body.appendChild(clubeMiniTable(['Data', 'Motivo', 'Pontos'], data.points.history.slice(0, 20).map(function(h){
        return [formatDate(h.created_at), h.reason, (h.delta > 0 ? '+' : '') + h.delta];
      })));

      body.appendChild(textEl('h2', 'Compras'));
      body.appendChild(clubeMiniTable(['Número', 'Total', 'Status', 'Data'], data.orders.map(function(o){
        return [o.order_number, formatMoney(o.total), o.status, formatDate(o.created_at)];
      })));

      body.appendChild(textEl('h2', 'Cupons'));
      body.appendChild(clubeMiniTable(['Código', 'Nome', 'Status'], data.coupons.map(function(c){
        return [c.code, c.name, c.status];
      })));

      body.appendChild(textEl('h2', 'Benefícios utilizados'));
      body.appendChild(clubeMiniTable(['Benefício', 'Data'], data.benefitRedemptions.map(function(b){
        return [b.name, formatDate(b.redeemed_at)];
      })));

      body.appendChild(textEl('h2', 'Presentes resgatados'));
      body.appendChild(clubeMiniTable(['Presente', 'Data'], data.giftRedemptions.map(function(g){
        return [g.name, formatDate(g.redeemed_at)];
      })));
    }).catch(function(err){ clear(body); showToast(err.message, true); });
  }
  document.getElementById('clube-membro-back-btn').addEventListener('click', function(){
    clubeMembrosDetailView.hidden = true; clubeMembrosListView.hidden = false;
  });

  var clubeState = { search: '', status: '' };
  var clubeListView = document.getElementById('clube-list-view');
  var clubeGerarView = document.getElementById('clube-gerar-view');

  function loadClube(){
    var wrap = document.getElementById('clube-table-wrap');
    clear(wrap);
    var qs = '?search=' + encodeURIComponent(clubeState.search) + '&status=' + encodeURIComponent(clubeState.status);
    api('/api/admin/club-codes' + qs).then(function(data){
      if(!data.items.length){
        wrap.appendChild(textEl('div', 'Nenhum código encontrado.', 'empty-state'));
        return;
      }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Código</th><th>Identificação</th><th>Status</th><th>Cliente</th><th>Ativado em</th><th>Ações</th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(c){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', c.code));
        tr.appendChild(textEl('td', c.label || '—'));
        var statusTd = document.createElement('td');
        statusTd.appendChild(textEl('span', CLUB_STATUS_LABELS[c.status] || c.status, 'badge ' + (CLUB_STATUS_BADGES[c.status] || 'badge-neutral')));
        tr.appendChild(statusTd);
        tr.appendChild(textEl('td', c.customer_name ? (c.customer_name + ' (' + c.customer_email + ')') : '—'));
        tr.appendChild(textEl('td', c.activated_at ? formatDate(c.activated_at) : '—'));
        var actionsTd = document.createElement('td');
        actionsTd.className = 'table-actions';
        if(c.status === 'ativo'){
          var blockBtn = document.createElement('button');
          blockBtn.type = 'button'; blockBtn.textContent = 'Bloquear';
          blockBtn.addEventListener('click', function(){
            api('/api/admin/club-codes?id=' + c.id, { method: 'PUT', body: { status: 'bloqueado' } }).then(function(){
              showToast('Código bloqueado.'); loadClube();
            }).catch(function(err){ showToast(err.message, true); });
          });
          actionsTd.appendChild(blockBtn);
        } else if(c.status === 'bloqueado'){
          var reactivateBtn = document.createElement('button');
          reactivateBtn.type = 'button'; reactivateBtn.textContent = 'Reativar';
          reactivateBtn.addEventListener('click', function(){
            api('/api/admin/club-codes?id=' + c.id, { method: 'PUT', body: { status: 'ativo' } }).then(function(){
              showToast('Código reativado.'); loadClube();
            }).catch(function(err){ showToast(err.message, true); });
          });
          actionsTd.appendChild(reactivateBtn);
        } else {
          actionsTd.appendChild(textEl('span', '—'));
        }
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }

  var clubeSearchTimer = null;
  document.getElementById('clube-search').addEventListener('input', function(e){
    window.clearTimeout(clubeSearchTimer);
    clubeSearchTimer = window.setTimeout(function(){ clubeState.search = e.target.value.trim(); loadClube(); }, 300);
  });
  document.getElementById('clube-status-filter').addEventListener('change', function(e){
    clubeState.status = e.target.value; loadClube();
  });
  document.getElementById('clube-gerar-btn').addEventListener('click', function(){
    document.getElementById('clube-gerar-form').reset();
    document.getElementById('clube-gerar-result').hidden = true;
    clear(document.getElementById('clube-gerar-result'));
    clubeListView.hidden = true; clubeGerarView.hidden = false;
  });
  document.getElementById('clube-gerar-back-btn').addEventListener('click', function(){
    clubeGerarView.hidden = true; clubeListView.hidden = false; loadClube();
  });
  document.getElementById('clube-gerar-form').addEventListener('submit', function(e){
    e.preventDefault();
    var count = Number(document.getElementById('clube-gerar-count').value) || 1;
    var label = document.getElementById('clube-gerar-label').value.trim();
    var btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/club-codes', { method: 'POST', body: { count: count, label: label } }).then(function(data){
      setLoading(btn, false);
      showToast(data.items.length + ' código(s) gerado(s).');
      var resultWrap = document.getElementById('clube-gerar-result');
      clear(resultWrap);
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Código gerado</th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(c){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', c.code));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      resultWrap.appendChild(table);
      resultWrap.hidden = false;
    }).catch(function(err){ setLoading(btn, false); showToast(err.message, true); });
  });

  /* ---- Níveis ---- */
  var clubeNiveisListView = document.getElementById('clube-niveis-list-view');
  var clubeNivelFormView = document.getElementById('clube-nivel-form-view');
  var clubeNivelForm = document.getElementById('clube-nivel-form');

  function loadClubeNiveis(){
    var wrap = document.getElementById('clube-niveis-table-wrap');
    clear(wrap);
    api('/api/admin/club-tiers').then(function(data){
      clubeTierCache = data.items;
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhum nível cadastrado.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>Compras mínimas</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(t){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', t.name));
        tr.appendChild(textEl('td', formatMoney(t.min_spent)));
        var statusTd = document.createElement('td'); statusTd.appendChild(clubeBadge(t.active)); tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showClubeNivelForm(t); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  function showClubeNivelForm(tier){
    clubeNiveisListView.hidden = true; clubeNivelFormView.hidden = false;
    clubeNivelForm.reset();
    document.getElementById('clube-nivel-form-title').textContent = tier ? 'Editar nível' : 'Novo nível';
    document.getElementById('clube-nivel-id').value = tier ? tier.id : '';
    document.getElementById('clube-nivel-name').value = tier ? tier.name : '';
    document.getElementById('clube-nivel-min-spent').value = tier ? tier.min_spent : 0;
    document.getElementById('clube-nivel-sort').value = tier ? tier.sort_order : 0;
    document.getElementById('clube-nivel-description').value = tier ? (tier.description || '') : '';
    document.getElementById('clube-nivel-active').checked = tier ? Boolean(tier.active) : true;
    watchDirty(clubeNivelForm);
  }
  document.getElementById('clube-nivel-new-btn').addEventListener('click', function(){ showClubeNivelForm(null); });
  document.getElementById('clube-nivel-back-btn').addEventListener('click', function(){ clubeNivelFormView.hidden = true; clubeNiveisListView.hidden = false; clearDirty(); });
  document.getElementById('clube-nivel-cancel-btn').addEventListener('click', function(){ document.getElementById('clube-nivel-back-btn').click(); });
  clubeNivelForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('clube-nivel-id').value;
    var body = {
      name: document.getElementById('clube-nivel-name').value.trim(),
      minSpent: Number(document.getElementById('clube-nivel-min-spent').value),
      sortOrder: Number(document.getElementById('clube-nivel-sort').value) || 0,
      description: document.getElementById('clube-nivel-description').value.trim(),
      active: document.getElementById('clube-nivel-active').checked,
    };
    var btn = clubeNivelForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/club-tiers?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/club-tiers', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Nível atualizado.' : 'Nível criado.');
      clubeNivelFormView.hidden = true; clubeNiveisListView.hidden = false;
      loadClubeNiveis();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  /* ---- Benefícios ---- */
  var clubeBeneficiosListView = document.getElementById('clube-beneficios-list-view');
  var clubeBeneficioFormView = document.getElementById('clube-beneficio-form-view');
  var clubeBeneficioForm = document.getElementById('clube-beneficio-form');

  function loadClubeBeneficios(){
    var wrap = document.getElementById('clube-beneficios-table-wrap');
    clear(wrap);
    api('/api/admin/club-benefits').then(function(data){
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhum benefício cadastrado.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>Nível necessário</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(b){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', b.name));
        tr.appendChild(textEl('td', b.tier_name || 'Todos os níveis'));
        var statusTd = document.createElement('td'); statusTd.appendChild(clubeBadge(b.active)); tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showClubeBeneficioForm(b); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  function showClubeBeneficioForm(b){
    clubeBeneficiosListView.hidden = true; clubeBeneficioFormView.hidden = false;
    clubeBeneficioForm.reset();
    populateClubeTierSelect(document.getElementById('clube-beneficio-tier')).then(function(){
      document.getElementById('clube-beneficio-tier').value = b && b.tier_id ? b.tier_id : '';
    });
    document.getElementById('clube-beneficio-delete-btn').hidden = !b;
    document.getElementById('clube-beneficio-form-title').textContent = b ? 'Editar benefício' : 'Novo benefício';
    document.getElementById('clube-beneficio-id').value = b ? b.id : '';
    document.getElementById('clube-beneficio-name').value = b ? b.name : '';
    document.getElementById('clube-beneficio-sort').value = b ? b.sort_order : 0;
    document.getElementById('clube-beneficio-description').value = b ? (b.description || '') : '';
    document.getElementById('clube-beneficio-validity').value = b ? (b.validity_note || '') : '';
    document.getElementById('clube-beneficio-active').checked = b ? Boolean(b.active) : true;
    watchDirty(clubeBeneficioForm);
  }
  document.getElementById('clube-beneficio-new-btn').addEventListener('click', function(){ showClubeBeneficioForm(null); });
  document.getElementById('clube-beneficio-back-btn').addEventListener('click', function(){ clubeBeneficioFormView.hidden = true; clubeBeneficiosListView.hidden = false; clearDirty(); });
  document.getElementById('clube-beneficio-cancel-btn').addEventListener('click', function(){ document.getElementById('clube-beneficio-back-btn').click(); });
  document.getElementById('clube-beneficio-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('clube-beneficio-id').value;
    if (!id) return;
    confirmDialog('Tem certeza que deseja excluir este benefício?').then(function(ok){
      if (!ok) return;
      api('/api/admin/club-benefits?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty(); showToast('Benefício excluído.');
        clubeBeneficioFormView.hidden = true; clubeBeneficiosListView.hidden = false;
        loadClubeBeneficios();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });
  clubeBeneficioForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('clube-beneficio-id').value;
    var body = {
      name: document.getElementById('clube-beneficio-name').value.trim(),
      tierId: document.getElementById('clube-beneficio-tier').value || null,
      sortOrder: Number(document.getElementById('clube-beneficio-sort').value) || 0,
      description: document.getElementById('clube-beneficio-description').value.trim(),
      validityNote: document.getElementById('clube-beneficio-validity').value.trim(),
      active: document.getElementById('clube-beneficio-active').checked,
    };
    var btn = clubeBeneficioForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/club-benefits?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/club-benefits', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Benefício atualizado.' : 'Benefício criado.');
      clubeBeneficioFormView.hidden = true; clubeBeneficiosListView.hidden = false;
      loadClubeBeneficios();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  /* ---- Pontos: regras ---- */
  var clubeRegrasListView = document.getElementById('clube-regras-list-view');
  var clubeRegraFormView = document.getElementById('clube-regra-form-view');
  var clubeRegraForm = document.getElementById('clube-regra-form');

  function loadClubeRegras(){
    var wrap = document.getElementById('clube-regras-table-wrap');
    clear(wrap);
    api('/api/admin/club-points-rules').then(function(data){
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhuma regra cadastrada.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Regra</th><th>Pontos</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(r){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', r.label));
        tr.appendChild(textEl('td', (r.points_value > 0 ? '+' : '') + r.points_value));
        var statusTd = document.createElement('td'); statusTd.appendChild(clubeBadge(r.active)); tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showClubeRegraForm(r); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  function showClubeRegraForm(r){
    clubeRegrasListView.hidden = true; clubeRegraFormView.hidden = false;
    clubeRegraForm.reset();
    document.getElementById('clube-regra-delete-btn').hidden = !r;
    document.getElementById('clube-regra-form-title').textContent = r ? 'Editar regra' : 'Nova regra';
    document.getElementById('clube-regra-id').value = r ? r.id : '';
    document.getElementById('clube-regra-label').value = r ? r.label : '';
    document.getElementById('clube-regra-points').value = r ? r.points_value : 1;
    document.getElementById('clube-regra-sort').value = r ? r.sort_order : 0;
    document.getElementById('clube-regra-description').value = r ? (r.description || '') : '';
    document.getElementById('clube-regra-active').checked = r ? Boolean(r.active) : true;
    watchDirty(clubeRegraForm);
  }
  document.getElementById('clube-regra-new-btn').addEventListener('click', function(){ showClubeRegraForm(null); });
  document.getElementById('clube-regra-back-btn').addEventListener('click', function(){ clubeRegraFormView.hidden = true; clubeRegrasListView.hidden = false; clearDirty(); });
  document.getElementById('clube-regra-cancel-btn').addEventListener('click', function(){ document.getElementById('clube-regra-back-btn').click(); });
  document.getElementById('clube-regra-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('clube-regra-id').value;
    if (!id) return;
    confirmDialog('Tem certeza que deseja excluir esta regra?').then(function(ok){
      if (!ok) return;
      api('/api/admin/club-points-rules?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty(); showToast('Regra excluída.');
        clubeRegraFormView.hidden = true; clubeRegrasListView.hidden = false;
        loadClubeRegras();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });
  clubeRegraForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('clube-regra-id').value;
    var body = {
      label: document.getElementById('clube-regra-label').value.trim(),
      pointsValue: Number(document.getElementById('clube-regra-points').value),
      sortOrder: Number(document.getElementById('clube-regra-sort').value) || 0,
      description: document.getElementById('clube-regra-description').value.trim(),
      active: document.getElementById('clube-regra-active').checked,
    };
    var btn = clubeRegraForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/club-points-rules?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/club-points-rules', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Regra atualizada.' : 'Regra criada.');
      clubeRegraFormView.hidden = true; clubeRegrasListView.hidden = false;
      loadClubeRegras();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  /* ---- Pontos: recompensas ---- */
  var clubeRecompensasListView = document.getElementById('clube-recompensas-list-view');
  var clubeRecompensaFormView = document.getElementById('clube-recompensa-form-view');
  var clubeRecompensaForm = document.getElementById('clube-recompensa-form');

  function loadClubeRecompensas(){
    var wrap = document.getElementById('clube-recompensas-table-wrap');
    clear(wrap);
    api('/api/admin/club-rewards').then(function(data){
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhuma recompensa cadastrada.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>Custo</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(r){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', r.name));
        tr.appendChild(textEl('td', r.points_cost + ' pontos'));
        var statusTd = document.createElement('td'); statusTd.appendChild(clubeBadge(r.active)); tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showClubeRecompensaForm(r); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  function showClubeRecompensaForm(r){
    clubeRecompensasListView.hidden = true; clubeRecompensaFormView.hidden = false;
    clubeRecompensaForm.reset();
    document.getElementById('clube-recompensa-delete-btn').hidden = !r;
    document.getElementById('clube-recompensa-form-title').textContent = r ? 'Editar recompensa' : 'Nova recompensa';
    document.getElementById('clube-recompensa-id').value = r ? r.id : '';
    document.getElementById('clube-recompensa-name').value = r ? r.name : '';
    document.getElementById('clube-recompensa-cost').value = r ? r.points_cost : 100;
    document.getElementById('clube-recompensa-sort').value = r ? r.sort_order : 0;
    document.getElementById('clube-recompensa-description').value = r ? (r.description || '') : '';
    document.getElementById('clube-recompensa-active').checked = r ? Boolean(r.active) : true;
    watchDirty(clubeRecompensaForm);
  }
  document.getElementById('clube-recompensa-new-btn').addEventListener('click', function(){ showClubeRecompensaForm(null); });
  document.getElementById('clube-recompensa-back-btn').addEventListener('click', function(){ clubeRecompensaFormView.hidden = true; clubeRecompensasListView.hidden = false; clearDirty(); });
  document.getElementById('clube-recompensa-cancel-btn').addEventListener('click', function(){ document.getElementById('clube-recompensa-back-btn').click(); });
  document.getElementById('clube-recompensa-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('clube-recompensa-id').value;
    if (!id) return;
    confirmDialog('Tem certeza que deseja excluir esta recompensa?').then(function(ok){
      if (!ok) return;
      api('/api/admin/club-rewards?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty(); showToast('Recompensa excluída.');
        clubeRecompensaFormView.hidden = true; clubeRecompensasListView.hidden = false;
        loadClubeRecompensas();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });
  clubeRecompensaForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('clube-recompensa-id').value;
    var body = {
      name: document.getElementById('clube-recompensa-name').value.trim(),
      pointsCost: Number(document.getElementById('clube-recompensa-cost').value),
      sortOrder: Number(document.getElementById('clube-recompensa-sort').value) || 0,
      description: document.getElementById('clube-recompensa-description').value.trim(),
      active: document.getElementById('clube-recompensa-active').checked,
    };
    var btn = clubeRecompensaForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/club-rewards?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/club-rewards', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Recompensa atualizada.' : 'Recompensa criada.');
      clubeRecompensaFormView.hidden = true; clubeRecompensasListView.hidden = false;
      loadClubeRecompensas();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  /* ---- Pontos: ajuste manual ---- */
  document.getElementById('clube-ajuste-form').addEventListener('submit', function(e){
    e.preventDefault();
    var customerId = document.getElementById('clube-ajuste-membro').value;
    var delta = Number(document.getElementById('clube-ajuste-delta').value);
    var reason = document.getElementById('clube-ajuste-reason').value.trim();
    if (!customerId) { showToast('Selecione um membro.', true); return; }
    var btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/club-points-adjust', { method: 'POST', body: { customerId: customerId, delta: delta, reason: reason } }).then(function(data){
      showToast('Ajuste aplicado. Novo saldo: ' + data.balance + ' pontos.');
      e.target.reset();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  /* ---- Cupons ---- */
  var CLUBE_COUPON_STATUS_BADGE = function(active){ return active ? 'badge-published' : 'badge-draft'; };
  var clubeCuponsListView = document.getElementById('clube-cupons-list-view');
  var clubeCupomFormView = document.getElementById('clube-cupom-form-view');
  var clubeCupomForm = document.getElementById('clube-cupom-form');

  function loadClubeCupons(){
    var wrap = document.getElementById('clube-cupons-table-wrap');
    clear(wrap);
    api('/api/admin/club-coupons').then(function(data){
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhum cupom cadastrado.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Código</th><th>Nome</th><th>Desconto</th><th>Com membros</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(c){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', c.code));
        tr.appendChild(textEl('td', c.name));
        tr.appendChild(textEl('td', c.discount_label));
        tr.appendChild(textEl('td', String(c.holders)));
        var statusTd = document.createElement('td'); statusTd.appendChild(clubeBadge(c.active)); tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showClubeCupomForm(c); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  function showClubeCupomForm(c){
    clubeCuponsListView.hidden = true; clubeCupomFormView.hidden = false;
    clubeCupomForm.reset();
    document.getElementById('clube-cupom-delete-btn').hidden = !c;
    document.getElementById('clube-cupom-form-title').textContent = c ? 'Editar cupom' : 'Novo cupom';
    document.getElementById('clube-cupom-id').value = c ? c.id : '';
    document.getElementById('clube-cupom-name').value = c ? c.name : '';
    document.getElementById('clube-cupom-code').value = c ? c.code : '';
    document.getElementById('clube-cupom-discount').value = c ? c.discount_label : '';
    document.getElementById('clube-cupom-valid-until').value = c && c.valid_until ? String(c.valid_until).slice(0, 10) : '';
    document.getElementById('clube-cupom-auto-grant').checked = c ? Boolean(c.auto_grant) : false;
    document.getElementById('clube-cupom-description').value = c ? (c.description || '') : '';
    document.getElementById('clube-cupom-active').checked = c ? Boolean(c.active) : true;
    watchDirty(clubeCupomForm);
  }
  document.getElementById('clube-cupom-new-btn').addEventListener('click', function(){ showClubeCupomForm(null); });
  document.getElementById('clube-cupom-back-btn').addEventListener('click', function(){ clubeCupomFormView.hidden = true; clubeCuponsListView.hidden = false; clearDirty(); });
  document.getElementById('clube-cupom-cancel-btn').addEventListener('click', function(){ document.getElementById('clube-cupom-back-btn').click(); });
  document.getElementById('clube-cupom-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('clube-cupom-id').value;
    if (!id) return;
    confirmDialog('Tem certeza que deseja excluir este cupom?').then(function(ok){
      if (!ok) return;
      api('/api/admin/club-coupons?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty(); showToast('Cupom excluído.');
        clubeCupomFormView.hidden = true; clubeCuponsListView.hidden = false;
        loadClubeCupons();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });
  clubeCupomForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('clube-cupom-id').value;
    var body = {
      name: document.getElementById('clube-cupom-name').value.trim(),
      code: document.getElementById('clube-cupom-code').value.trim().toUpperCase(),
      discountLabel: document.getElementById('clube-cupom-discount').value.trim(),
      validUntil: document.getElementById('clube-cupom-valid-until').value || null,
      autoGrant: document.getElementById('clube-cupom-auto-grant').checked,
      description: document.getElementById('clube-cupom-description').value.trim(),
      active: document.getElementById('clube-cupom-active').checked,
    };
    var btn = clubeCupomForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/club-coupons?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/club-coupons', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Cupom atualizado.' : 'Cupom criado.');
      clubeCupomFormView.hidden = true; clubeCuponsListView.hidden = false;
      loadClubeCupons();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  /* ---- Presentes ---- */
  var CLUBE_GIFT_TRIGGER_LABELS = { aniversario_cliente: 'Aniversário do cliente', aniversario_membro: 'Aniversário de membro', manual: 'Concessão manual' };
  var clubePresentesListView = document.getElementById('clube-presentes-list-view');
  var clubePresenteFormView = document.getElementById('clube-presente-form-view');
  var clubePresenteForm = document.getElementById('clube-presente-form');
  var clubePresenteGrantBox = document.getElementById('clube-presente-grant-box');

  function loadClubePresentes(){
    var wrap = document.getElementById('clube-presentes-table-wrap');
    clear(wrap);
    api('/api/admin/club-gifts').then(function(data){
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhum presente cadastrado.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Nome</th><th>Gatilho</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(g){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', g.name));
        tr.appendChild(textEl('td', CLUBE_GIFT_TRIGGER_LABELS[g.trigger_type] || g.trigger_type));
        var statusTd = document.createElement('td'); statusTd.appendChild(clubeBadge(g.active)); tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showClubePresenteForm(g); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  function showClubePresenteForm(g){
    clubePresentesListView.hidden = true; clubePresenteFormView.hidden = false;
    clubePresenteForm.reset();
    document.getElementById('clube-presente-delete-btn').hidden = !g;
    document.getElementById('clube-presente-form-title').textContent = g ? 'Editar presente' : 'Novo presente';
    document.getElementById('clube-presente-id').value = g ? g.id : '';
    document.getElementById('clube-presente-name').value = g ? g.name : '';
    document.getElementById('clube-presente-trigger').value = g ? g.trigger_type : 'manual';
    document.getElementById('clube-presente-reward-type').value = g ? g.reward_type : 'cupom';
    document.getElementById('clube-presente-reward-value').value = g ? (g.reward_value || '') : '';
    document.getElementById('clube-presente-description').value = g ? (g.description || '') : '';
    document.getElementById('clube-presente-active').checked = g ? Boolean(g.active) : true;
    clubePresenteGrantBox.hidden = !(g && g.trigger_type === 'manual');
    if (g && g.trigger_type === 'manual') populateClubeMemberSelect(document.getElementById('clube-presente-grant-membro'));
    watchDirty(clubePresenteForm);
  }
  document.getElementById('clube-presente-trigger').addEventListener('change', function(e){
    var id = document.getElementById('clube-presente-id').value;
    clubePresenteGrantBox.hidden = !(id && e.target.value === 'manual');
  });
  document.getElementById('clube-presente-new-btn').addEventListener('click', function(){ showClubePresenteForm(null); });
  document.getElementById('clube-presente-back-btn').addEventListener('click', function(){ clubePresenteFormView.hidden = true; clubePresentesListView.hidden = false; clearDirty(); });
  document.getElementById('clube-presente-cancel-btn').addEventListener('click', function(){ document.getElementById('clube-presente-back-btn').click(); });
  document.getElementById('clube-presente-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('clube-presente-id').value;
    if (!id) return;
    confirmDialog('Tem certeza que deseja excluir este presente?').then(function(ok){
      if (!ok) return;
      api('/api/admin/club-gifts?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty(); showToast('Presente excluído.');
        clubePresenteFormView.hidden = true; clubePresentesListView.hidden = false;
        loadClubePresentes();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });
  clubePresenteForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('clube-presente-id').value;
    var body = {
      name: document.getElementById('clube-presente-name').value.trim(),
      triggerType: document.getElementById('clube-presente-trigger').value,
      rewardType: document.getElementById('clube-presente-reward-type').value,
      rewardValue: document.getElementById('clube-presente-reward-value').value.trim(),
      description: document.getElementById('clube-presente-description').value.trim(),
      active: document.getElementById('clube-presente-active').checked,
    };
    var btn = clubePresenteForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/club-gifts?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/club-gifts', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Presente atualizado.' : 'Presente criado.');
      clubePresenteFormView.hidden = true; clubePresentesListView.hidden = false;
      loadClubePresentes();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });
  document.getElementById('clube-presente-grant-form').addEventListener('submit', function(e){
    e.preventDefault();
    var giftId = document.getElementById('clube-presente-id').value;
    var customerId = document.getElementById('clube-presente-grant-membro').value;
    if (!customerId) { showToast('Selecione um membro.', true); return; }
    var btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/club-gifts?id=' + giftId + '&action=grant', { method: 'POST', body: { customerId: customerId } }).then(function(){
      showToast('Presente concedido ao membro.');
      e.target.reset();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  /* ---- Novidades ---- */
  var clubeNovidadesListView = document.getElementById('clube-novidades-list-view');
  var clubeNovidadeFormView = document.getElementById('clube-novidade-form-view');
  var clubeNovidadeForm = document.getElementById('clube-novidade-form');
  var clubeNovidadeImageUploader = null;

  function loadClubeNovidades(){
    var wrap = document.getElementById('clube-novidades-table-wrap');
    clear(wrap);
    api('/api/admin/club-news').then(function(data){
      if (!data.items.length) { wrap.appendChild(textEl('div', 'Nenhuma novidade cadastrada.', 'empty-state')); return; }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Título</th><th>Publicação</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.items.forEach(function(n){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', n.title));
        tr.appendChild(textEl('td', formatDate(n.published_at)));
        var statusTd = document.createElement('td'); statusTd.appendChild(clubeBadge(n.active)); tr.appendChild(statusTd);
        var actionsTd = document.createElement('td'); actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showClubeNovidadeForm(n); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }
  function showClubeNovidadeForm(n){
    clubeNovidadesListView.hidden = true; clubeNovidadeFormView.hidden = false;
    clubeNovidadeForm.reset();
    document.getElementById('clube-novidade-delete-btn').hidden = !n;
    document.getElementById('clube-novidade-form-title').textContent = n ? 'Editar novidade' : 'Nova novidade';
    document.getElementById('clube-novidade-id').value = n ? n.id : '';
    document.getElementById('clube-novidade-title').value = n ? n.title : '';
    document.getElementById('clube-novidade-published-at').value = n && n.published_at ? String(n.published_at).slice(0, 10) : '';
    document.getElementById('clube-novidade-description').value = n ? (n.description || '') : '';
    document.getElementById('clube-novidade-active').checked = n ? Boolean(n.active) : true;
    var wrap = document.getElementById('clube-novidade-image');
    clubeNovidadeImageUploader = createImageUploader(wrap, {
      urls: n && n.image_url ? [n.image_url] : [], multiple: false, folder: 'club-news', onChange: function(){}
    });
    watchDirty(clubeNovidadeForm);
  }
  document.getElementById('clube-novidade-new-btn').addEventListener('click', function(){ showClubeNovidadeForm(null); });
  document.getElementById('clube-novidade-back-btn').addEventListener('click', function(){ clubeNovidadeFormView.hidden = true; clubeNovidadesListView.hidden = false; clearDirty(); });
  document.getElementById('clube-novidade-cancel-btn').addEventListener('click', function(){ document.getElementById('clube-novidade-back-btn').click(); });
  document.getElementById('clube-novidade-delete-btn').addEventListener('click', function(){
    var id = document.getElementById('clube-novidade-id').value;
    if (!id) return;
    confirmDialog('Tem certeza que deseja excluir esta novidade?').then(function(ok){
      if (!ok) return;
      api('/api/admin/club-news?id=' + id, { method: 'DELETE' }).then(function(){
        clearDirty(); showToast('Novidade excluída.');
        clubeNovidadeFormView.hidden = true; clubeNovidadesListView.hidden = false;
        loadClubeNovidades();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });
  clubeNovidadeForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('clube-novidade-id').value;
    var urls = clubeNovidadeImageUploader ? clubeNovidadeImageUploader.getUrls() : [];
    var body = {
      title: document.getElementById('clube-novidade-title').value.trim(),
      publishedAt: document.getElementById('clube-novidade-published-at').value || null,
      description: document.getElementById('clube-novidade-description').value.trim(),
      imageUrl: urls[0] || '',
      active: document.getElementById('clube-novidade-active').checked,
    };
    var btn = clubeNovidadeForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/club-news?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/club-news', { method: 'POST', body: body });
    req.then(function(){
      clearDirty();
      showToast(id ? 'Novidade atualizada.' : 'Novidade criada.');
      clubeNovidadeFormView.hidden = true; clubeNovidadesListView.hidden = false;
      loadClubeNovidades();
    }).catch(function(err){ showToast(err.message, true); }).finally(function(){ setLoading(btn, false); });
  });

  loaders.clube = function(){
    document.querySelectorAll('#clube-subtabs .tab-btn').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-clube-tab') === 'membros'); });
    document.querySelectorAll('[data-clube-panel]').forEach(function(p){ p.hidden = p.getAttribute('data-clube-panel') !== 'membros'; });
    document.getElementById('clube-membros-search').value = '';
    clubeMembrosDetailView.hidden = true; clubeMembrosListView.hidden = false;
    loadClubeMembros();

    clubeState = { search: '', status: '' };
    document.getElementById('clube-search').value = '';
    document.getElementById('clube-status-filter').value = '';
    clubeGerarView.hidden = true; clubeListView.hidden = false;

    clubeNiveisListView.hidden = false; clubeNivelFormView.hidden = true;
    clubeBeneficiosListView.hidden = false; clubeBeneficioFormView.hidden = true;
    clubeRegrasListView.hidden = false; clubeRegraFormView.hidden = true;
    clubeRecompensasListView.hidden = false; clubeRecompensaFormView.hidden = true;
    clubeCuponsListView.hidden = false; clubeCupomFormView.hidden = true;
    clubePresentesListView.hidden = false; clubePresenteFormView.hidden = true;
    clubeNovidadesListView.hidden = false; clubeNovidadeFormView.hidden = true;
    document.querySelectorAll('#clube-pontos-subtabs .tab-btn').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-clube-pontos-tab') === 'regras'); });
    document.querySelectorAll('[data-clube-pontos-panel]').forEach(function(p){ p.hidden = p.getAttribute('data-clube-pontos-panel') !== 'regras'; });
  };

  /* ============================ Leads ============================ */
  var leadsState = { page: 1, search: '' };
  var leadsSearchInput = document.getElementById('leads-search');
  var leadsSearchTimer = null;
  leadsSearchInput.addEventListener('input', function(){
    window.clearTimeout(leadsSearchTimer);
    leadsSearchTimer = window.setTimeout(function(){
      leadsState.search = leadsSearchInput.value.trim();
      leadsState.page = 1;
      loadLeads();
    }, 300);
  });

  function loadLeads(){
    var wrap = document.getElementById('leads-table-wrap');
    var pager = document.getElementById('leads-pagination');
    clear(wrap); clear(pager);
    var qs = '?page=' + leadsState.page + '&pageSize=25' + (leadsState.search ? '&search=' + encodeURIComponent(leadsState.search) : '');
    api('/api/admin/leads' + qs).then(function(data){
      document.getElementById('leads-total-count').textContent = String(data.total);
      if(!data.items.length){
        wrap.appendChild(textEl('div', 'Nenhum cadastro encontrado.', 'empty-state'));
        return;
      }
      var table = document.createElement('table');
      table.className = 'admin-table';
      var thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Nome</th><th>E-mail</th><th>Data</th></tr>';
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      data.items.forEach(function(item){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', item.name));
        tr.appendChild(textEl('td', item.email));
        tr.appendChild(textEl('td', formatDate(item.created_at)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);

      var totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
      var prevBtn = document.createElement('button');
      prevBtn.type = 'button'; prevBtn.textContent = 'Anterior';
      prevBtn.disabled = leadsState.page <= 1;
      prevBtn.addEventListener('click', function(){ leadsState.page -= 1; loadLeads(); });
      var nextBtn = document.createElement('button');
      nextBtn.type = 'button'; nextBtn.textContent = 'Próxima';
      nextBtn.disabled = leadsState.page >= totalPages;
      nextBtn.addEventListener('click', function(){ leadsState.page += 1; loadLeads(); });
      pager.appendChild(prevBtn);
      pager.appendChild(textEl('span', 'Página ' + leadsState.page + ' de ' + totalPages + ' (' + data.total + ' no total)'));
      pager.appendChild(nextBtn);
    }).catch(function(err){ showToast(err.message, true); });
  }
  loaders.leads = function(){ loadLeads(); };

  /* ============================ Mensagens ============================ */
  function loadMessages(){
    var wrap = document.getElementById('mensagens-list');
    clear(wrap);
    api('/api/admin/messages').then(function(data){
      if(!data.items.length){
        wrap.appendChild(textEl('div', 'Nenhuma mensagem recebida ainda.', 'empty-state'));
        return;
      }
      data.items.forEach(function(item){
        var card = document.createElement('div');
        card.className = 'message-card';

        var head = document.createElement('div');
        head.className = 'message-card-head';
        var who = document.createElement('div');
        who.appendChild(textEl('strong', item.name));
        who.appendChild(textEl('div', item.email + (item.subject ? ' — ' + item.subject : ''), 'message-meta'));
        head.appendChild(who);
        head.appendChild(textEl('div', formatDate(item.created_at), 'message-meta'));
        card.appendChild(head);

        card.appendChild(textEl('div', item.message, 'message-body'));

        var actions = document.createElement('div');
        actions.className = 'message-status-actions';
        ['novo', 'lido', 'respondido', 'arquivado'].forEach(function(status){
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = MESSAGE_STATUS_LABELS[status];
          btn.className = status === item.status ? 'is-active' : '';
          btn.addEventListener('click', function(){
            api('/api/admin/messages?id=' + item.id, { method: 'PUT', body: { status: status } }).then(function(){
              showToast('Mensagem marcada como ' + MESSAGE_STATUS_LABELS[status].toLowerCase() + '.');
              loadMessages();
              refreshMessagesBadge();
            }).catch(function(err){ showToast(err.message, true); });
          });
          actions.appendChild(btn);
        });
        card.appendChild(actions);

        wrap.appendChild(card);
      });
    }).catch(function(err){ showToast(err.message, true); });
  }
  loaders.mensagens = function(){ loadMessages(); refreshMessagesBadge(); };

  /* ============================ Conteúdo ============================ */
  var conteudoFields = {};
  var conteudoForm = document.getElementById('conteudo-form');
  function loadContent(){
    var wrap = conteudoForm;
    clear(wrap);
    conteudoFields = {};
    api('/api/admin/content').then(function(data){
      data.items.forEach(function(item){
        var field = document.createElement('div');
        field.className = 'field';
        var label = document.createElement('label');
        label.setAttribute('for', 'content-' + item.key);
        label.textContent = item.label;
        field.appendChild(label);
        var textarea = document.createElement('textarea');
        textarea.id = 'content-' + item.key;
        textarea.value = item.value || '';
        textarea.rows = item.value && item.value.length > 120 ? 4 : 2;
        field.appendChild(textarea);
        wrap.appendChild(field);
        conteudoFields[item.key] = textarea;
      });
      watchDirty(wrap);
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('conteudo-save-btn').addEventListener('click', function(){
    var updates = Object.keys(conteudoFields).map(function(key){
      return { key: key, value: conteudoFields[key].value };
    });
    var btn = document.getElementById('conteudo-save-btn');
    setLoading(btn, true);
    api('/api/admin/content', { method: 'PUT', body: { updates: updates } }).then(function(){
      clearDirty();
      showToast('Alterações salvas.');
    }).catch(function(err){
      showToast(err.message || 'Não foi possível salvar.', true);
    }).finally(function(){ setLoading(btn, false); });
  });
  loaders.conteudo = function(){ loadContent(); };

  /* ============================ FAQ ============================ */
  function faqItemNode(item, onReload){
    var wrap = document.createElement('div');
    wrap.className = 'faq-admin-item';

    var head = document.createElement('div');
    head.className = 'faq-admin-item-head';
    var strong = textEl('strong', item.question);
    if(!item.active) strong.style.opacity = '.55';
    head.appendChild(strong);

    var actions = document.createElement('div');
    actions.className = 'faq-admin-actions';
    var upBtn = document.createElement('button'); upBtn.type='button'; upBtn.textContent='↑'; upBtn.setAttribute('aria-label','Mover para cima');
    var downBtn = document.createElement('button'); downBtn.type='button'; downBtn.textContent='↓'; downBtn.setAttribute('aria-label','Mover para baixo');
    var toggleBtn = document.createElement('button'); toggleBtn.type='button'; toggleBtn.textContent = item.active ? 'Desativar' : 'Ativar';
    var editBtn = document.createElement('button'); editBtn.type='button'; editBtn.textContent='Editar';
    var delBtn = document.createElement('button'); delBtn.type='button'; delBtn.textContent='Excluir';
    [upBtn, downBtn, toggleBtn, editBtn, delBtn].forEach(function(b){ actions.appendChild(b); });
    head.appendChild(actions);
    wrap.appendChild(head);

    var answerPreview = document.createElement('div');
    answerPreview.className = 'faq-admin-answer';
    answerPreview.innerHTML = item.answer; // admin-authored content only
    wrap.appendChild(answerPreview);

    var editWrap = document.createElement('div');
    editWrap.className = 'faq-admin-edit';
    var qField = document.createElement('div'); qField.className = 'field';
    qField.innerHTML = '<label>Pergunta</label>';
    var qInput = document.createElement('input'); qInput.value = item.question; qField.appendChild(qInput);
    var aField = document.createElement('div'); aField.className = 'field';
    aField.innerHTML = '<label>Resposta</label>';
    var aInput = document.createElement('textarea'); aInput.rows = 3; aInput.value = item.answer; aField.appendChild(aInput);
    var saveBtn = document.createElement('button'); saveBtn.type='button'; saveBtn.className='btn-primary'; saveBtn.textContent='Salvar pergunta';
    editWrap.appendChild(qField); editWrap.appendChild(aField); editWrap.appendChild(saveBtn);
    wrap.appendChild(editWrap);

    editBtn.addEventListener('click', function(){ wrap.classList.toggle('is-editing'); });
    saveBtn.addEventListener('click', function(){
      var q = qInput.value.trim(), a = aInput.value.trim();
      if(!q || !a){ showToast('Preencha pergunta e resposta.', true); return; }
      api('/api/admin/faq?id=' + item.id, { method: 'PUT', body: { question: q, answer: a } }).then(function(){
        showToast('Pergunta atualizada.');
        onReload();
      }).catch(function(err){ showToast(err.message, true); });
    });
    toggleBtn.addEventListener('click', function(){
      api('/api/admin/faq?id=' + item.id, { method: 'PUT', body: { active: !item.active } }).then(function(){
        showToast(item.active ? 'Pergunta desativada.' : 'Pergunta ativada.');
        onReload();
      }).catch(function(err){ showToast(err.message, true); });
    });
    delBtn.addEventListener('click', function(){
      confirmDialog('Tem certeza que deseja excluir esta pergunta?').then(function(ok){
        if(!ok) return;
        api('/api/admin/faq?id=' + item.id, { method: 'DELETE' }).then(function(){
          showToast('Pergunta excluída.');
          onReload();
        }).catch(function(err){ showToast(err.message, true); });
      });
    });
    upBtn.addEventListener('click', function(){ moveFaq(item, -1, onReload); });
    downBtn.addEventListener('click', function(){ moveFaq(item, 1, onReload); });

    return wrap;
  }

  var faqCache = [];
  function moveFaq(item, dir, onReload){
    var idx = faqCache.findIndex(function(f){ return f.id === item.id; });
    var swapIdx = idx + dir;
    if(swapIdx < 0 || swapIdx >= faqCache.length) return;
    var other = faqCache[swapIdx];
    api('/api/admin/faq', { method: 'PUT', body: { reorder: [
      { id: item.id, sortOrder: other.sort_order },
      { id: other.id, sortOrder: item.sort_order }
    ] } }).then(function(){ onReload(); }).catch(function(err){ showToast(err.message, true); });
  }

  function loadFaq(){
    var wrap = document.getElementById('faq-list');
    clear(wrap);
    api('/api/admin/faq').then(function(data){
      faqCache = data.items;
      if(!data.items.length){
        wrap.appendChild(textEl('div', 'Nenhuma pergunta cadastrada.', 'empty-state'));
        return;
      }
      data.items.forEach(function(item){ wrap.appendChild(faqItemNode(item, loadFaq)); });
    }).catch(function(err){ showToast(err.message, true); });
  }
  var faqNewForm = document.getElementById('faq-new-form');
  document.getElementById('faq-new-btn').addEventListener('click', function(){
    faqNewForm.hidden = !faqNewForm.hidden;
    if(!faqNewForm.hidden) document.getElementById('faq-new-question').focus();
  });
  document.getElementById('faq-new-cancel-btn').addEventListener('click', function(){
    faqNewForm.reset();
    faqNewForm.hidden = true;
  });
  faqNewForm.addEventListener('submit', function(e){
    e.preventDefault();
    var question = document.getElementById('faq-new-question').value.trim();
    var answer = document.getElementById('faq-new-answer').value.trim();
    if(!question || !answer){ showToast('Preencha pergunta e resposta.', true); return; }
    var btn = faqNewForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/faq', { method: 'POST', body: { question: question, answer: answer } }).then(function(){
      showToast('Pergunta criada.');
      faqNewForm.reset();
      faqNewForm.hidden = true;
      loadFaq();
    }).catch(function(err){ showToast(err.message || 'Não foi possível criar a pergunta.', true); })
      .finally(function(){ setLoading(btn, false); });
  });
  loaders.faq = function(){ loadFaq(); };

  /* ============================ Mídia ============================ */
  var midiaState = { search: '' };
  function loadMedia(){
    var wrap = document.getElementById('midia-grid');
    clear(wrap);
    var qs = '?withUsage=1' + (midiaState.search ? '&search=' + encodeURIComponent(midiaState.search) : '');
    api('/api/admin/media' + qs).then(function(data){
      if(!data.items.length){
        wrap.appendChild(textEl('div', 'Nenhuma imagem enviada ainda.', 'empty-state'));
        return;
      }
      data.items.forEach(function(item){
        var card = document.createElement('div');
        card.className = 'media-card';
        var img = document.createElement('img');
        img.src = item.url; img.alt = item.filename;
        card.appendChild(img);
        card.appendChild(textEl('div', item.filename, 'media-filename'));
        card.appendChild(textEl('div', item.size_bytes ? Math.round(item.size_bytes / 1024) + ' KB · ' + formatDate(item.uploaded_at) : formatDate(item.uploaded_at), 'media-meta'));
        if(item.usedIn && item.usedIn.length){
          card.appendChild(textEl('div', 'Em uso: ' + item.usedIn.map(function(u){ return u.label || u.type; }).join(', '), 'media-usage'));
        } else {
          card.appendChild(textEl('div', 'Não utilizada em nenhum lugar', 'media-usage media-usage-unused'));
        }
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button'; copyBtn.className = 'btn-ghost'; copyBtn.textContent = 'Copiar URL';
        copyBtn.addEventListener('click', function(){
          navigator.clipboard.writeText(item.url).then(function(){ showToast('URL copiada.'); }).catch(function(){ showToast('Não foi possível copiar.', true); });
        });
        var delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.className = 'btn-danger-ghost'; delBtn.textContent = 'Excluir';
        delBtn.addEventListener('click', function(){
          confirmDialog('Tem certeza que deseja excluir "' + item.filename + '"?').then(function(ok){
            if(!ok) return;
            api('/api/admin/media?id=' + item.id, { method: 'DELETE' }).then(function(){
              showToast('Arquivo excluído.');
              loadMedia();
            }).catch(function(err){
              if(err.status === 409) showToast('Este arquivo está em uso e não pode ser excluído.', true);
              else showToast(err.message, true);
            });
          });
        });
        var cardActions = document.createElement('div');
        cardActions.className = 'media-card-actions';
        cardActions.appendChild(copyBtn);
        cardActions.appendChild(delBtn);
        card.appendChild(cardActions);
        wrap.appendChild(card);
      });
    }).catch(function(err){ showToast(err.message, true); });
  }
  var midiaSearchTimer = null;
  document.getElementById('midia-search').addEventListener('input', function(e){
    window.clearTimeout(midiaSearchTimer);
    midiaSearchTimer = window.setTimeout(function(){ midiaState.search = e.target.value.trim(); loadMedia(); }, 300);
  });
  document.getElementById('midia-upload-input').addEventListener('change', function(e){
    var file = e.target.files[0];
    e.target.value = '';
    if(!file) return;
    api('/api/admin/upload?folder=geral', { method: 'POST', raw: true, body: file, contentType: file.type }).then(function(){
      showToast('Imagem enviada.');
      loadMedia();
    }).catch(function(err){ showToast(err.message || 'Falha ao enviar imagem.', true); });
  });
  loaders.midia = function(){ midiaState.search = ''; document.getElementById('midia-search').value = ''; loadMedia(); };

  /* ============================ SEO ============================ */
  var seoImageUploader = null;
  function loadSeo(){
    api('/api/admin/seo').then(function(data){
      var seo = data.seo || {};
      document.getElementById('seo-title').value = seo.site_title || '';
      document.getElementById('seo-description').value = seo.meta_description || '';
      var wrap = document.getElementById('seo-image');
      seoImageUploader = createImageUploader(wrap, {
        urls: seo.share_image_url ? [seo.share_image_url] : [],
        multiple: false, folder: 'seo', onChange: function(){}
      });
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('seo-form').addEventListener('submit', function(e){
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    var urls = seoImageUploader ? seoImageUploader.getUrls() : [];
    setLoading(btn, true);
    api('/api/admin/seo', { method: 'PUT', body: {
      siteTitle: document.getElementById('seo-title').value.trim(),
      metaDescription: document.getElementById('seo-description').value.trim(),
      shareImageUrl: urls[0] || ''
    }}).then(function(){
      showToast('Alterações salvas.');
    }).catch(function(err){ showToast(err.message || 'Não foi possível salvar.', true); })
      .finally(function(){ setLoading(btn, false); });
  });
  loaders.seo = function(){ loadSeo(); };

  /* ============================ Aparência ============================ */
  var aparenciaLogoUploader = null;
  var aparenciaFaviconUploader = null;
  function loadAparencia(){
    api('/api/admin/appearance').then(function(data){
      var a = data.appearance || {};
      aparenciaLogoUploader = createImageUploader(document.getElementById('aparencia-logo'), {
        urls: a.logo_url ? [a.logo_url] : [], multiple: false, folder: 'appearance', onChange: function(){}
      });
      aparenciaFaviconUploader = createImageUploader(document.getElementById('aparencia-favicon'), {
        urls: a.favicon_url ? [a.favicon_url] : [], multiple: false, folder: 'appearance', onChange: function(){}
      });
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('aparencia-form').addEventListener('submit', function(e){
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/appearance', { method: 'PUT', body: {
      logoUrl: aparenciaLogoUploader ? (aparenciaLogoUploader.getUrls()[0] || '') : '',
      faviconUrl: aparenciaFaviconUploader ? (aparenciaFaviconUploader.getUrls()[0] || '') : ''
    }}).then(function(){
      showToast('Alterações salvas.');
    }).catch(function(err){ showToast(err.message || 'Não foi possível salvar.', true); })
      .finally(function(){ setLoading(btn, false); });
  });
  loaders.aparencia = function(){ loadAparencia(); };

  /* ============================ Configurações ============================ */
  function loadConfig(){
    api('/api/admin/settings').then(function(data){
      var s = data.settings || {};
      document.getElementById('config-brand').value = s.brand_name || 'VERITÉ';
      document.getElementById('config-instagram').value = s.instagram_url || '';
      document.getElementById('config-whatsapp').value = s.whatsapp_number || '';
      document.getElementById('config-email').value = s.contact_email || '';
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('config-form').addEventListener('submit', function(e){
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/settings', { method: 'PUT', body: {
      brandName: document.getElementById('config-brand').value.trim(),
      instagramUrl: document.getElementById('config-instagram').value.trim(),
      whatsappNumber: document.getElementById('config-whatsapp').value.trim(),
      contactEmail: document.getElementById('config-email').value.trim()
    }}).then(function(){
      showToast('Alterações salvas.');
    }).catch(function(err){ showToast(err.message || 'Não foi possível salvar.', true); })
      .finally(function(){ setLoading(btn, false); });
  });
  loaders.configuracoes = function(){ loadConfig(); };

  /* ============================ Minha conta ============================ */
  function loadConta(){
    api('/api/admin/account').then(function(data){
      var a = data.account || {};
      document.getElementById('conta-email').value = a.email || '';
      document.getElementById('conta-name').value = a.displayName || '';
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('conta-form').addEventListener('submit', function(e){
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    api('/api/admin/account', { method: 'PUT', body: {
      displayName: document.getElementById('conta-name').value.trim()
    }}).then(function(){
      showToast('Alterações salvas.');
    }).catch(function(err){ showToast(err.message || 'Não foi possível salvar.', true); })
      .finally(function(){ setLoading(btn, false); });
  });
  document.getElementById('conta-logout-others-btn').addEventListener('click', function(){
    var btn = this;
    confirmDialog('Isso vai encerrar o acesso ao painel em qualquer outro navegador/dispositivo. Sua sessão aqui continua ativa. Confirmar?').then(function(ok){
      if(!ok) return;
      btn.disabled = true;
      api('/api/admin/account?action=logout-others', { method: 'POST' }).then(function(){
        showToast('Sessões em outros dispositivos foram encerradas.');
      }).catch(function(err){ showToast(err.message || 'Não foi possível encerrar as sessões.', true); })
        .finally(function(){ btn.disabled = false; });
    });
  });
  loaders['minha-conta'] = function(){ loadConta(); };

  /* ============================ Boot ============================ */
  function boot(){
    loadCategoriesCache();
    loadNotifications();
    refreshMessagesBadge();
  }

  api('/api/admin/me').then(function(){
    showApp();
    boot();
    navigate(currentRoute() || 'dashboard');
  }).catch(function(){
    showLogin();
  });
})();
