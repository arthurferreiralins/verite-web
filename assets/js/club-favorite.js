/**
 * Botão "Salvar nos favoritos do Clube" em produto.html. Só aparece se o
 * visitante já estiver logado no Clube (verificado via /api/club/me — a
 * mesma sessão da área /clube, cookie compartilhado no mesmo domínio).
 * Quem não é membro simplesmente não vê o botão, sem erro visível.
 */
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
        if (!res.ok || data.ok === false) throw new Error((data && data.error) || 'Erro.');
        return data;
      });
    });
  }

  function init() {
    var btn = document.getElementById('product-favorite');
    if (!btn) return;
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');
    if (!slug) return;

    api('/api/club/me').then(function () {
      return api('/api/club/favorites').then(function (data) {
        var isFav = data.items.some(function (p) { return p.slug === slug; });
        btn.hidden = false;
        setState(isFav);
      });
    }).catch(function () {
      // não logado no Clube — botão fica oculto
    });

    function setState(isFav) {
      btn.classList.toggle('is-favorited', isFav);
      btn.textContent = isFav ? 'Nos favoritos do Clube' : 'Salvar nos favoritos do Clube';
      btn.dataset.fav = isFav ? '1' : '0';
    }

    btn.addEventListener('click', function () {
      var isFav = btn.dataset.fav === '1';
      btn.disabled = true;
      var req = isFav
        ? api('/api/club/favorites?slug=' + encodeURIComponent(slug), { method: 'DELETE' })
        : api('/api/club/favorites', { method: 'POST', body: { slug: slug } });
      req.then(function () {
        btn.disabled = false;
        setState(!isFav);
      }).catch(function () {
        btn.disabled = false;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
