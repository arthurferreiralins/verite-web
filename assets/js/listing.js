/**
 * Página de listagem única (produtos.html): lê filtros da querystring,
 * monta a barra de filtros/ordenação a partir do catálogo carregado e
 * renderiza a grade — chamado por assets/js/products-loader.js assim que
 * window.VERITE_PRODUCTS chega da API.
 */
(function(){
  'use strict';

  var TITLES = {
    categoria: { perfumes:'Perfumaria', 'oleos-corporais':'Óleos Corporais', kits:'Kits', presentes:'Presentes', novidades:'Novidades' },
    genero: { feminino:'Femininos', masculino:'Masculinos', unissex:'Unissex' },
    colecao: { lancamentos:'Lançamentos', 'mais-vendidos':'Mais Vendidos', ofertas:'Ofertas', exclusivos:'Exclusivos do Clube' }
  };

  function updateUrl(filters){
    var params = new URLSearchParams();
    Object.keys(filters).forEach(function(k){
      if(filters[k] && !(k === 'ordenar' && filters[k] === 'relevancia')) params.set(k, filters[k]);
    });
    var qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  function buildTitle(f){
    if(f.busca) return 'Resultados para "' + f.busca + '"';
    if(f.colecao && TITLES.colecao[f.colecao]) return TITLES.colecao[f.colecao];
    if(f.genero && TITLES.genero[f.genero]) return TITLES.genero[f.genero];
    if(f.categoria && TITLES.categoria[f.categoria]) return TITLES.categoria[f.categoria];
    return 'Nossos Perfumes';
  }

  function distinctValues(products, field){
    var set = {};
    products.forEach(function(p){ if(p[field]) set[p[field]] = true; });
    return Object.keys(set).sort();
  }

  function initListing(){
    var root = document.getElementById('listing');
    if(!root) return;

    var VP = window.VeriteProducts;
    var catalog = VP.all();
    var filters = VP.readFilters();

    /* filtros rápidos do banner: marca o ativo conforme a querystring */
    (function markQuickChips(){
      var chips = document.querySelectorAll('.catalog-chip');
      if(!chips.length) return;
      var active = filters.busca ? null
        : filters.colecao === 'lancamentos' ? 'lancamentos'
        : filters.genero === 'feminino' ? 'feminino'
        : filters.genero === 'masculino' ? 'masculino'
        : (!filters.genero && !filters.colecao && !filters.categoria && !filters.familia) ? 'todos'
        : null;
      chips.forEach(function(c){ c.classList.toggle('is-active', c.getAttribute('data-chip') === active); });
    })();

    var titleEl = document.getElementById('listing-title');
    var countEl = document.getElementById('listing-count');
    var gridEl = document.getElementById('listing-grid');
    var emptyEl = document.getElementById('listing-empty');
    var skeletonEl = document.getElementById('listing-skeleton');
    var sortSelect = document.getElementById('listing-sort');
    var genderFieldset = document.getElementById('listing-filter-gender');
    var categoryFieldset = document.getElementById('listing-filter-category');
    var familySelect = document.getElementById('listing-filter-family');
    var priceMinInput = document.getElementById('listing-filter-price-min');
    var priceMaxInput = document.getElementById('listing-filter-price-max');
    var clearBtn = document.getElementById('listing-clear-filters');
    var filterToggle = document.getElementById('listing-filter-toggle');
    var filterPanel = document.getElementById('listing-filters');

    function buildCheckList(container, items, activeValue, name){
      if(!container) return;
      container.innerHTML = '';
      items.forEach(function(item){
        var label = document.createElement('label');
        label.className = 'listing-filter-option';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = item.slug || item;
        input.checked = (item.slug || item) === activeValue;
        var span = document.createElement('span');
        span.textContent = item.label || item;
        label.appendChild(input);
        label.appendChild(span);
        container.appendChild(label);
        input.addEventListener('change', function(){ filters[name === 'genero' ? 'genero' : 'categoria'] = input.checked ? input.value : ''; renderAll(); });
      });
      var allLabel = document.createElement('label');
      allLabel.className = 'listing-filter-option';
      var allInput = document.createElement('input');
      allInput.type = 'radio';
      allInput.name = name;
      allInput.value = '';
      allInput.checked = !activeValue;
      var allSpan = document.createElement('span');
      allSpan.textContent = 'Todos';
      allLabel.appendChild(allInput);
      allLabel.appendChild(allSpan);
      container.insertBefore(allLabel, container.firstChild);
      allInput.addEventListener('change', function(){ filters[name === 'genero' ? 'genero' : 'categoria'] = ''; renderAll(); });
    }

    function buildFamilySelect(){
      if(!familySelect) return;
      var families = distinctValues(catalog, 'olfactoryFamily');
      familySelect.innerHTML = '<option value="">Todas as famílias</option>';
      families.forEach(function(f){
        var opt = document.createElement('option');
        opt.value = f; opt.textContent = f;
        if(f === filters.familia) opt.selected = true;
        familySelect.appendChild(opt);
      });
    }

    function renderActiveFilters(){
      var wrap = document.getElementById('listing-active-filters');
      if(!wrap) return;
      wrap.innerHTML = '';
      if(filters.colecao && TITLES.colecao[filters.colecao]){
        var chip = document.createElement('span');
        chip.className = 'listing-filter-chip';
        chip.appendChild(document.createTextNode(TITLES.colecao[filters.colecao]));
        var clearChipBtn = document.createElement('button');
        clearChipBtn.type = 'button';
        clearChipBtn.setAttribute('aria-label', 'Remover filtro ' + TITLES.colecao[filters.colecao]);
        clearChipBtn.textContent = '×';
        clearChipBtn.addEventListener('click', function(){
          filters.colecao = '';
          renderAll();
        });
        chip.appendChild(clearChipBtn);
        wrap.appendChild(chip);
      }
      wrap.hidden = !wrap.children.length;
    }

    function renderAll(){
      updateUrl(filters);
      if(titleEl) titleEl.textContent = buildTitle(filters);
      renderActiveFilters();

      var filtered = VP.applySort(VP.applyFilters(catalog, filters), filters.ordenar);

      if(skeletonEl) skeletonEl.hidden = true;
      if(countEl) countEl.textContent = filtered.length + (filtered.length === 1 ? ' perfume encontrado' : ' perfumes encontrados');

      if(!filtered.length){
        if(gridEl) gridEl.hidden = true;
        if(emptyEl){
          emptyEl.hidden = false;
          var emptyTitle = emptyEl.querySelector('.category-empty-title');
          var emptySub = emptyEl.querySelector('.category-empty-sub');
          if(!catalog.length){
            if(emptyTitle) emptyTitle.textContent = 'Em preparação.';
            if(emptySub) emptySub.textContent = 'Uma nova expressão da VERITÉ está sendo criada.';
          } else {
            if(emptyTitle) emptyTitle.textContent = 'Nenhum resultado encontrado.';
            if(emptySub) emptySub.textContent = 'Tente ajustar os filtros ou buscar por outro termo.';
          }
        }
      } else {
        if(emptyEl) emptyEl.hidden = true;
        if(gridEl){ gridEl.hidden = false; VP.renderGrid(gridEl, filtered); }
      }
    }

    buildCheckList(genderFieldset, VP.GENDERS, filters.genero, 'genero');
    buildCheckList(categoryFieldset, VP.CATEGORIES, filters.categoria, 'categoria');
    buildFamilySelect();

    if(sortSelect){
      sortSelect.value = filters.ordenar || 'relevancia';
      sortSelect.addEventListener('change', function(){ filters.ordenar = sortSelect.value; renderAll(); });
    }
    if(familySelect){
      familySelect.addEventListener('change', function(){ filters.familia = familySelect.value; renderAll(); });
    }
    if(priceMinInput){
      priceMinInput.value = filters.precoMin || '';
      priceMinInput.addEventListener('change', function(){ filters.precoMin = priceMinInput.value; renderAll(); });
    }
    if(priceMaxInput){
      priceMaxInput.value = filters.precoMax || '';
      priceMaxInput.addEventListener('change', function(){ filters.precoMax = priceMaxInput.value; renderAll(); });
    }
    if(clearBtn){
      clearBtn.addEventListener('click', function(){
        filters = { categoria:'', genero:'', colecao:'', busca:filters.busca, familia:'', volume:'', precoMin:'', precoMax:'', ordenar:'relevancia' };
        buildCheckList(genderFieldset, VP.GENDERS, '', 'genero');
        buildCheckList(categoryFieldset, VP.CATEGORIES, '', 'categoria');
        if(familySelect) familySelect.value = '';
        if(priceMinInput) priceMinInput.value = '';
        if(priceMaxInput) priceMaxInput.value = '';
        if(sortSelect) sortSelect.value = 'relevancia';
        renderAll();
      });
    }
    if(filterToggle && filterPanel){
      filterToggle.addEventListener('click', function(){
        var open = filterPanel.classList.toggle('is-open');
        filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    renderAll();
  }

  window.VeriteInitListing = initListing;
})();
