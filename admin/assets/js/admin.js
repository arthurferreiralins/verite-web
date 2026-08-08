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

  var CATEGORY_LABELS = {
    'perfumes': 'Perfumes',
    'oleos-corporais': 'Óleos Corporais',
    'kits': 'Kits',
    'novidades': 'Novidades'
  };
  var STATUS_LABELS = { draft: 'Rascunho', published: 'Publicado' };
  var MESSAGE_STATUS_LABELS = { novo: 'Nova', lido: 'Lida', respondido: 'Respondida' };

  function formatDate(iso){
    try { return new Date(iso).toLocaleString('pt-BR'); } catch(e){ return iso; }
  }
  function formatMoney(value){
    if(value == null || value === '') return '—';
    try { return new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(value)); }
    catch(e){ return String(value); }
  }

  /* ============================ Image uploader ============================ */
  function createImageUploader(container, opts){
    // opts: { urls: [..], multiple: bool, onChange: fn(urls) }
    var urls = (opts.urls || []).slice();

    function upload(file){
      return api('/api/admin/upload', { method: 'POST', raw: true, body: file, contentType: file.type })
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
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
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
    return { getUrls: function(){ return urls.slice(); } };
  }

  /* ============================ Auth ============================ */
  var loginView = document.getElementById('login-view');
  var appView = document.getElementById('app-view');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');

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
      navigate(currentRoute() || 'dashboard');
    }).catch(function(err){
      loginError.textContent = err.message || 'Não foi possível entrar.';
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
  var ROUTES = ['dashboard', 'produtos', 'leads', 'mensagens', 'conteudo', 'faq', 'seo', 'configuracoes'];
  var loaders = {};

  function currentRoute(){
    var hash = window.location.hash.replace('#', '');
    return ROUTES.indexOf(hash) !== -1 ? hash : null;
  }

  function navigate(route){
    if(ROUTES.indexOf(route) === -1) route = 'dashboard';
    document.querySelectorAll('.admin-section').forEach(function(s){ s.hidden = s.getAttribute('data-section') !== route; });
    document.querySelectorAll('.sidebar-nav a').forEach(function(a){
      a.classList.toggle('is-active', a.getAttribute('data-route') === route);
    });
    closeSidebar();
    if(window.location.hash !== '#' + route) window.location.hash = route;
    if(loaders[route]) loaders[route]();
  }

  document.querySelectorAll('.sidebar-nav a').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      navigate(a.getAttribute('data-route'));
    });
  });
  window.addEventListener('hashchange', function(){
    var r = currentRoute();
    if(r) navigate(r);
  });

  /* ============================ Dashboard ============================ */
  loaders.dashboard = function(){
    var wrap = document.getElementById('dashboard-cards');
    clear(wrap);
    api('/api/admin/dashboard').then(function(data){
      var cards = [
        { n: data.leads, label: 'Pessoas na lista de espera' },
        { n: data.messagesTotal, label: 'Mensagens recebidas' },
        { n: data.messages.novo, label: 'Mensagens novas' },
        { n: data.products.published, label: 'Produtos publicados' },
        { n: data.products.draft, label: 'Produtos em rascunho' }
      ];
      cards.forEach(function(c){
        var card = document.createElement('div');
        card.className = 'stat-card';
        card.appendChild(textEl('div', String(c.n), 'n'));
        card.appendChild(textEl('div', c.label, 'label'));
        wrap.appendChild(card);
      });
    }).catch(function(err){ showToast(err.message, true); });
  };

  /* ============================ Produtos ============================ */
  var produtosListView = document.getElementById('produtos-list-view');
  var produtosFormView = document.getElementById('produtos-form-view');
  var produtoForm = document.getElementById('produto-form');
  var produtoFormTitle = document.getElementById('produto-form-title');
  var produtoMainImageUploader = null;
  var produtoGalleryUploader = null;
  var produtoSlugTouched = false;

  document.getElementById('produto-slug').addEventListener('input', function(){ produtoSlugTouched = true; });
  var DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
  document.getElementById('produto-name').addEventListener('input', function(){
    if(produtoSlugTouched) return;
    var slugField = document.getElementById('produto-slug');
    slugField.value = document.getElementById('produto-name').value
      .toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  });

  function loadProductsList(){
    var wrap = document.getElementById('produtos-table-wrap');
    clear(wrap);
    api('/api/admin/products').then(function(data){
      if(!data.products.length){
        wrap.appendChild(textEl('div', 'Nenhum produto cadastrado ainda.', 'empty-state'));
        return;
      }
      var table = document.createElement('table');
      table.className = 'admin-table';
      var thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Nome</th><th>Categoria</th><th>Status</th><th>Destaque</th><th></th></tr>';
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      data.products.forEach(function(p){
        var tr = document.createElement('tr');
        tr.appendChild(textEl('td', p.name));
        tr.appendChild(textEl('td', CATEGORY_LABELS[p.category] || p.category));
        var statusTd = document.createElement('td');
        var badge = textEl('span', STATUS_LABELS[p.status] || p.status, 'badge badge-' + p.status);
        statusTd.appendChild(badge);
        tr.appendChild(statusTd);
        tr.appendChild(textEl('td', p.featured ? 'Sim' : 'Não'));
        var actionsTd = document.createElement('td');
        actionsTd.className = 'table-actions';
        var editBtn = document.createElement('button');
        editBtn.type = 'button'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function(){ showProductForm(p); });
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }).catch(function(err){ showToast(err.message, true); });
  }

  function showProductForm(product){
    produtosListView.hidden = true;
    produtosFormView.hidden = false;
    produtoForm.reset();
    produtoSlugTouched = false;
    document.getElementById('produto-delete-btn').hidden = !product;
    produtoFormTitle.textContent = product ? 'Editar produto' : 'Novo produto';
    document.getElementById('produto-id').value = product ? product.id : '';
    document.getElementById('produto-name').value = product ? product.name : '';
    document.getElementById('produto-slug').value = product ? product.slug : '';
    produtoSlugTouched = Boolean(product);
    document.getElementById('produto-category').value = product ? product.category : 'perfumes';
    document.getElementById('produto-volume').value = product ? (product.volume || '') : '';
    document.getElementById('produto-price').value = product && product.price != null ? product.price : '';
    document.getElementById('produto-sale-price').value = product && product.sale_price != null ? product.sale_price : '';
    document.getElementById('produto-short-desc').value = product ? (product.short_description || '') : '';
    document.getElementById('produto-desc').value = product ? (product.description || '') : '';
    document.getElementById('produto-status').value = product ? product.status : 'draft';
    document.getElementById('produto-featured').checked = Boolean(product && product.featured);

    var mainWrap = document.getElementById('produto-main-image');
    produtoMainImageUploader = createImageUploader(mainWrap, {
      urls: product && product.main_image_url ? [product.main_image_url] : [],
      multiple: false,
      onChange: function(){}
    });
    var galleryWrap = document.getElementById('produto-gallery');
    produtoGalleryUploader = createImageUploader(galleryWrap, {
      urls: product && product.gallery_urls ? product.gallery_urls : [],
      multiple: true,
      onChange: function(){}
    });
  }

  document.getElementById('produto-new-btn').addEventListener('click', function(){ showProductForm(null); });
  document.getElementById('produto-back-btn').addEventListener('click', function(){
    produtosFormView.hidden = true; produtosListView.hidden = false;
  });
  document.getElementById('produto-cancel-btn').addEventListener('click', function(){
    produtosFormView.hidden = true; produtosListView.hidden = false;
  });

  produtoForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id = document.getElementById('produto-id').value;
    var name = document.getElementById('produto-name').value.trim();
    if(!name){ showToast('Informe o nome do produto.', true); return; }

    var mainUrls = produtoMainImageUploader ? produtoMainImageUploader.getUrls() : [];
    var body = {
      name: name,
      slug: document.getElementById('produto-slug').value.trim(),
      category: document.getElementById('produto-category').value,
      volume: document.getElementById('produto-volume').value.trim(),
      price: document.getElementById('produto-price').value,
      salePrice: document.getElementById('produto-sale-price').value,
      shortDescription: document.getElementById('produto-short-desc').value.trim(),
      description: document.getElementById('produto-desc').value.trim(),
      status: document.getElementById('produto-status').value,
      featured: document.getElementById('produto-featured').checked,
      mainImageUrl: mainUrls[0] || '',
      gallery: produtoGalleryUploader ? produtoGalleryUploader.getUrls() : []
    };

    var btn = produtoForm.querySelector('button[type="submit"]');
    setLoading(btn, true);
    var req = id ? api('/api/admin/products?id=' + id, { method: 'PUT', body: body })
                 : api('/api/admin/products', { method: 'POST', body: body });
    req.then(function(){
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
        showToast('Produto excluído.');
        produtosFormView.hidden = true; produtosListView.hidden = false;
        loadProductsList();
      }).catch(function(err){ showToast(err.message, true); });
    });
  });

  loaders.produtos = function(){
    produtosFormView.hidden = true;
    produtosListView.hidden = false;
    loadProductsList();
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
        ['novo', 'lido', 'respondido'].forEach(function(status){
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = MESSAGE_STATUS_LABELS[status];
          btn.className = status === item.status ? 'is-active' : '';
          btn.addEventListener('click', function(){
            api('/api/admin/messages?id=' + item.id, { method: 'PUT', body: { status: status } }).then(function(){
              showToast('Mensagem marcada como ' + MESSAGE_STATUS_LABELS[status].toLowerCase() + '.');
              loadMessages();
            }).catch(function(err){ showToast(err.message, true); });
          });
          actions.appendChild(btn);
        });
        card.appendChild(actions);

        wrap.appendChild(card);
      });
    }).catch(function(err){ showToast(err.message, true); });
  }
  loaders.mensagens = function(){ loadMessages(); };

  /* ============================ Conteúdo ============================ */
  var conteudoFields = {};
  function loadContent(){
    var wrap = document.getElementById('conteudo-form');
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
    }).catch(function(err){ showToast(err.message, true); });
  }
  document.getElementById('conteudo-save-btn').addEventListener('click', function(){
    var updates = Object.keys(conteudoFields).map(function(key){
      return { key: key, value: conteudoFields[key].value };
    });
    var btn = document.getElementById('conteudo-save-btn');
    setLoading(btn, true);
    api('/api/admin/content', { method: 'PUT', body: { updates: updates } }).then(function(){
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
        multiple: false,
        onChange: function(){}
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

  /* ============================ Boot ============================ */
  api('/api/admin/me').then(function(){
    showApp();
    navigate(currentRoute() || 'dashboard');
  }).catch(function(){
    showLogin();
  });
})();
