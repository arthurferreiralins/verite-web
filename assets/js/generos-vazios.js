/**
 * MENU, RODAPÉ E FILTROS: só o que tem produto publicado.
 *
 * Todo link que leva ao catálogo com um filtro (gênero, categoria ou
 * coleção — "Femininos", "Unissex", "Kits", "Óleos Corporais", "Lançamentos"
 * ...) só aparece se esse filtro tiver PELO MENOS UM produto publicado. Um
 * caminho que só leva a "0 perfumes encontrados" é pior do que caminho
 * nenhum.
 *
 * NADA É APAGADO. Os links, as colunas do mega menu e as opções de filtro
 * continuam no HTML e em VeriteProducts; só ganham `hidden`. No dia em que
 * existir um produto que os justifique, reaparecem sozinhos.
 *
 * CATÁLOGO INTEIRO VAZIO (hoje): sumir com tudo deixaria o menu sem
 * "Perfumes" e o rodapé sem "Comprar". Então, nesse estado, "Perfumes" vira a
 * lista das 4 fichas "em breve" (perfume-*.html) e o rodapé mostra o mesmo.
 * Assim que o painel publicar o primeiro produto, o menu volta ao normal.
 *
 * Funciona em TODAS as páginas: as que não carregam o catálogo por conta
 * própria (sobre, carrinho, legais...) buscam /api/public/products aqui.
 */
(function () {
  'use strict';

  var MARCA = 'data-sem-produto';
  var externo = null; /* catálogo buscado por este script, nas páginas sem loader */
  var ultimaChave = null;

  function catalogo() {
    if (window.VERITE_PRODUCTS) return window.VERITE_PRODUCTS;
    return externo; /* null = ainda não sabemos */
  }

  /* o mesmo critério de VeriteProducts.applyFilters, sem depender de
     products.js (que várias páginas não carregam) */
  function combina(p, f) {
    if (f.categoria && p.category !== f.categoria) return false;
    if (f.genero && p.gender !== f.genero) return false;
    if (f.colecao === 'lancamentos' && !p.isNew) return false;
    if (f.colecao === 'mais-vendidos' && !p.bestseller) return false;
    if (f.colecao === 'exclusivos' && !p.clubExclusive) return false;
    if (f.colecao === 'ofertas' && !(p.salePrice != null && p.price != null && p.salePrice < p.price)) return false;
    return true;
  }

  function contar(f) {
    var lista = catalogo() || [];
    var n = 0;
    for (var i = 0; i < lista.length; i++) if (lista[i] && combina(lista[i], f)) n++;
    return n;
  }

  /* {genero, categoria, colecao} de um href do catálogo, ou null se o link
     não filtra nada (ex.: produtos.html?busca=... ou outras páginas) */
  function facetas(href) {
    if (!href || href.indexOf('?') < 0) return null;
    var partes = href.split('?');
    if (!/(^|\/)produtos\.html$/.test(partes[0])) return null;
    var q;
    try { q = new URLSearchParams(partes[1].split('#')[0]); } catch (e) { return null; }
    var f = { genero: q.get('genero') || '', categoria: q.get('categoria') || '', colecao: q.get('colecao') || '' };
    return (f.genero || f.categoria || f.colecao) ? f : null;
  }

  /* esconde/mostra marcando com um atributo próprio, para nunca brigar com um
     `hidden` que já viesse do HTML por outro motivo */
  function definir(el, esconder) {
    if (!el) return;
    if (esconder) {
      if (!el.hasAttribute(MARCA)) { el.setAttribute(MARCA, ''); el.hidden = true; }
    } else if (el.hasAttribute(MARCA)) {
      el.removeAttribute(MARCA); el.hidden = false;
    }
  }
  function alvoDoLink(a) { return a.closest('li') || a; }
  function visivel(el) { return !el.hidden && !(el.closest('li') && el.closest('li').hidden); }

  function fichas() { return (window.VeritePerfumes && window.VeritePerfumes.lista) || []; }

  /* ---------- catálogo vazio: menu e rodapé viram a lista das fichas ---------- */
  function mostrarEmBreve() {
    var lista = fichas();
    if (!lista.length) return;

    var item = document.querySelector('.nav-item[data-mega="perfumes"]');
    if (item) {
      definir(item, false);
      var painel = item.querySelector('.mega-panel');
      var inner = painel && painel.querySelector('.mega-panel-inner');
      if (painel && inner && !inner.querySelector('[data-embreve]')) {
        painel.classList.add('mega-panel-brief');
        var col = document.createElement('div');
        col.className = 'mega-col';
        col.setAttribute('data-embreve', '');
        var t = document.createElement('p');
        t.className = 'mega-col-title';
        t.textContent = 'Em breve';
        col.appendChild(t);
        lista.forEach(function (p) {
          var a = document.createElement('a');
          a.href = p.ficha;
          a.setAttribute('data-perfume', p.slug);
          a.textContent = p.nome;
          col.appendChild(a);
        });
        inner.appendChild(col);
        var cta = painel.querySelector('.mega-cta');
        if (cta) { definir(cta, false); cta.setAttribute('href', 'produtos.html'); }
      }
    }

    /* rodapé: "Comprar" leva a nada; "Coleção" leva às fichas */
    Array.prototype.forEach.call(document.querySelectorAll('footer .footer-col'), function (col) {
      var h = col.querySelector('h4');
      var ul = col.querySelector('ul');
      if (!h || !ul || col.hasAttribute('data-embreve')) return;
      if (h.textContent.trim() !== 'Comprar') return;
      col.setAttribute('data-embreve', '');
      h.textContent = 'Coleção';
      while (ul.firstChild) ul.removeChild(ul.firstChild);
      lista.forEach(function (p) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = p.ficha;
        a.setAttribute('data-perfume', p.slug);
        a.textContent = p.nome;
        li.appendChild(a);
        ul.appendChild(li);
      });
    });
  }

  function aplicar() {
    var lista = catalogo();
    if (lista === null || lista === undefined) return; /* ainda não sabemos: não mexe */
    var vazio = lista.length === 0;
    var chave = lista.length + ':' + (vazio ? 'v' : 'c');

    /* 1. links do cabeçalho e do rodapé que filtram o catálogo */
    Array.prototype.forEach.call(
      document.querySelectorAll('header a[href*="produtos.html?"], footer a[href*="produtos.html?"], .catalog-quick-filters a[href*="produtos.html?"]'),
      function (a) {
        var f = facetas(a.getAttribute('href'));
        if (!f) return;
        var sem = contar(f) === 0;
        if (a.classList.contains('mega-cta') || a.classList.contains('mega-col-all') || a.parentElement.classList.contains('mega-col')) {
          definir(a, sem);
        } else {
          definir(alvoDoLink(a), sem);
        }
      }
    );

    /* 2. colunas do mega menu sem nenhum link visível */
    Array.prototype.forEach.call(document.querySelectorAll('.mega-col:not([data-embreve])'), function (col) {
      var links = col.querySelectorAll('a');
      var vis = Array.prototype.filter.call(links, visivel);
      definir(col, links.length > 0 && vis.length === 0);
    });

    /* 3. item de menu sem coluna visível */
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item[data-mega]'), function (item) {
      var cols = item.querySelectorAll('.mega-col');
      var vis = Array.prototype.filter.call(cols, function (c) { return !c.hidden; });
      definir(item, cols.length > 0 && vis.length === 0);
    });

    /* 4. opções dos filtros do catálogo (gênero e categoria) */
    [['#listing-filter-gender', 'genero'], ['#listing-filter-category', 'categoria']].forEach(function (par) {
      Array.prototype.forEach.call(document.querySelectorAll(par[0] + ' input[value]'), function (input) {
        var f = {}; f[par[1]] = input.value;
        definir(input.closest('label') || input, contar(f) === 0);
      });
    });

    /* 5. catálogo vazio: em vez de sumir, "Perfumes" e o rodapé viram as fichas */
    if (vazio && chave !== ultimaChave) mostrarEmBreve();
    ultimaChave = chave;
  }

  function agendar() { window.requestAnimationFrame(aplicar); }

  window.addEventListener('verite:products-loaded', agendar);

  /* páginas sem products-loader.js: busca o catálogo aqui mesmo */
  if (!document.querySelector('script[src*="products-loader"]')) {
    fetch('/api/public/products')
      .then(function (r) { return r.ok ? r.json() : { products: [] }; })
      .then(function (d) { externo = (d && d.products) || []; agendar(); })
      .catch(function () { externo = []; agendar(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agendar);
  else agendar();

  /* o filtro do catálogo é remontado a cada mudança (listing.js) */
  var alvoFiltro = document.getElementById('listing-filter-gender');
  if (alvoFiltro && window.MutationObserver) {
    new window.MutationObserver(agendar).observe(alvoFiltro, { childList: true });
    var alvoCat = document.getElementById('listing-filter-category');
    if (alvoCat) new window.MutationObserver(agendar).observe(alvoCat, { childList: true });
  }
})();
