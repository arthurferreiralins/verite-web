/**
 * OS 4 PERFUMES DA VERITÉ — fonte única, e a lógica "ficha ou catálogo".
 *
 * Enquanto o painel não tiver um produto publicado para um perfume, o
 * "Conhecer" da home, a vitrine de produtos.html, o menu e o rodapé apontam
 * para a FICHA "em breve" dele (perfume-*.html). Quando o produto for
 * cadastrado e publicado no painel (aparece em /api/public/products), o
 * link passa sozinho a apontar para o produto real — ninguém precisa mexer
 * em código.
 *
 * SÓ DADOS REAIS: nome, volume, foto e a frase de cada sala da home. Nenhuma
 * nota olfativa, preço ou descrição inventada.
 * A lista tem o MESMO conteúdo de tools/gerar-fichas.py (que gera os HTML
 * das fichas); se um dado mudar, muda nos dois — o script avisa se divergir.
 */
(function () {
  'use strict';

  var PERFUMES = [
    { slug: 'feminino',  ficha: 'perfume-feminino.html',  nome: 'Verité Feminino',  volume: 'Eau de Parfum · 50 ml',
      frase: 'Sofisticação sem excesso.', img: 'assets/img/frasco-feminino.webp',    w: 540, h: 725, genero: 'feminino',  chave: 'feminino' },
    { slug: 'masculino', ficha: 'perfume-masculino.html', nome: 'Verité Masculino', volume: 'Eau de Parfum · 40 ml',
      frase: 'Uma presença que fica.',    img: 'assets/img/frasco-verite-hero.webp', w: 263, h: 481, genero: 'masculino', chave: 'masculino' },
    { slug: 'dorea',     ficha: 'perfume-dorea.html',     nome: 'Verité Doréa',     volume: 'Eau de Parfum · 30 ml',
      frase: 'Única, como você.',         img: 'assets/img/frasco-dorea.webp',       w: 560, h: 840, genero: 'feminino',  chave: 'dorea' },
    { slug: 'kit',       ficha: 'perfume-kit.html',       nome: 'Kit Verité',       volume: '30 ml · 50 ml · 20 ml',
      frase: 'Três frascos numa caixa. Para presentear, ou para começar a sua coleção.',
      img: 'assets/img/frasco-kits.webp', w: 760, h: 570, categoria: 'kits', chave: 'kit' }
  ];

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function catalogo() { return window.VERITE_PRODUCTS || []; }

  /* O produto REAL do catálogo que corresponde a este perfume, ou null.
     Casa pelo nome/slug (não pelo gênero: o Doréa é feminino e não pode ser
     confundido com o "Verité Feminino"). O kit também casa pela categoria. */
  function produtoReal(perfume, lista) {
    lista = lista || catalogo();
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      if (!p) continue;
      var alvo = norm(p.name) + ' ' + norm(p.slug);
      if (alvo.indexOf(perfume.chave) !== -1) return p;
      if (perfume.slug === 'kit' && p.category === 'kits') return p;
    }
    return null;
  }

  /* Para onde o "Conhecer" deste perfume deve levar AGORA */
  function destino(perfume, lista) {
    var real = produtoReal(perfume, lista);
    return real ? 'produto.html?slug=' + encodeURIComponent(real.slug || real.id) : perfume.ficha;
  }

  function porSlug(slug) {
    for (var i = 0; i < PERFUMES.length; i++) if (PERFUMES[i].slug === slug) return PERFUMES[i];
    return null;
  }

  /* Reaponta todo link marcado com data-perfume="<slug>" */
  function atualizarLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('a[data-perfume]'), function (a) {
      var pf = porSlug(a.getAttribute('data-perfume'));
      if (pf) a.setAttribute('href', destino(pf));
    });
  }

  window.VeritePerfumes = {
    lista: PERFUMES,
    porSlug: porSlug,
    produtoReal: produtoReal,
    destino: destino,
    /* true = o catálogo ainda não tem NENHUM produto publicado */
    catalogoVazio: function () { return catalogo().length === 0; },
    atualizarLinks: atualizarLinks
  };

  /* O HTML já nasce apontando para a ficha (funciona sem JS e sem API);
     quando o catálogo chega, os links que já têm produto real são trocados. */
  window.addEventListener('verite:products-loaded', atualizarLinks);
})();
