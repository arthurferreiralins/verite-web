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
  var ROUTES = ['dashboard', 'produtos', 'categorias', 'estoque', 'pedidos', 'clientes', 'clube', 'leads', 'mensagens', 'conteudo', 'faq', 'midia', 'seo', 'aparencia', 'configuracoes', 'minha-conta'];
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
    if(window.location.hash !== '#' + route) window.location.hash = route;
    if(loaders[route]) loaders[route]();
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
      var cards = [
        { n: data.productsTotal, label: 'PRODUTOS', sub: data.products.published + ' publicados · ' + data.products.draft + ' rascunhos' },
        { n: data.orders, label: 'PEDIDOS', sub: null },
        { n: data.customers, label: 'CLIENTES', sub: null },
        { n: data.leads, label: 'LISTA DE ESPERA', sub: null },
        { n: data.messagesTotal, label: 'MENSAGENS', sub: data.messages.novo + ' novas' },
        { n: data.lowStock, label: 'ESTOQUE', sub: data.lowStock > 0 ? 'produto(s) com estoque baixo/esgotado' : 'tudo em dia', warn: data.lowStock > 0 }
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
      seoDescription: document.getElementById('produto-seo-description').value.trim()
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

  /* ============================ Estoque ============================ */
  loaders.estoque = function(){
    var wrap = document.getElementById('estoque-table-wrap');
    clear(wrap);
    api('/api/admin/products').then(function(data){
      if(!data.products.length){
        wrap.appendChild(textEl('div', 'Nenhum produto cadastrado ainda.', 'empty-state'));
        return;
      }
      var table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = '<thead><tr><th>Produto</th><th>SKU</th><th>Quantidade</th><th>Status</th></tr></thead>';
      var tbody = document.createElement('tbody');
      data.products.forEach(function(p){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', p.name));
        tr.appendChild(textEl('td', p.sku || '—'));

        var qtyTd = document.createElement('td');
        if(p.track_stock){
          var qtyInput = document.createElement('input');
          qtyInput.type = 'number'; qtyInput.min = '0'; qtyInput.step = '1';
          qtyInput.value = p.stock_quantity;
          qtyInput.className = 'estoque-qty-input';
          qtyInput.addEventListener('change', function(){
            var val = Math.max(0, Math.trunc(Number(qtyInput.value) || 0));
            api('/api/admin/products?id=' + p.id, { method: 'PUT', body: { stockQuantity: val } }).then(function(){
              showToast('Estoque de "' + p.name + '" atualizado.');
              loaders.estoque();
            }).catch(function(err){ showToast(err.message, true); });
          });
          qtyTd.appendChild(qtyInput);
        } else {
          qtyTd.appendChild(textEl('span', '—', 'stock-qty'));
        }
        tr.appendChild(qtyTd);

        var statusTd = document.createElement('td');
        statusTd.innerHTML = stockBadgeHtml(p);
        tr.appendChild(statusTd);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
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

  loaders.clube = function(){
    clubeState = { search: '', status: '' };
    document.getElementById('clube-search').value = '';
    document.getElementById('clube-status-filter').value = '';
    clubeGerarView.hidden = true; clubeListView.hidden = false;
    loadClube();
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
