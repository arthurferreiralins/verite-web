/**
 * Favoritos abertos a qualquer visitante (não só membros do Clube Verité):
 * sem sessão de Clube, a lista fica em localStorage (só slugs); com sessão
 * de Clube, a lista real é a conta (/api/club/favorites, já existente).
 * Ao logar/cadastrar no Clube, mergeGuestFavoritesIntoAccount() sobe os
 * favoritos do navegador pra conta e limpa o localStorage — chamado por
 * clube/assets/js/club.js logo após login/registro terem sucesso.
 *
 * Substitui assets/js/club-favorite.js (que só funcionava logado).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'verite_favorites';
  var clubStatus = null; // null = ainda não checou, true/false = checado

  function readLocal() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(function (s) { return typeof s === 'string'; }) : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocal(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) { /* localStorage indisponível — segue sem persistir */ }
  }

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

  function checkClub() {
    if (clubStatus !== null) return Promise.resolve(clubStatus);
    return api('/api/club/me').then(function () { clubStatus = true; return true; })
      .catch(function () { clubStatus = false; return false; });
  }

  function listSlugs() {
    return checkClub().then(function (isMember) {
      if (!isMember) return readLocal();
      return api('/api/club/favorites').then(function (data) {
        return (data.items || []).map(function (p) { return p.slug; });
      }).catch(function () { return []; });
    });
  }

  function isFavorited(slug) {
    return listSlugs().then(function (slugs) { return slugs.indexOf(slug) !== -1; });
  }

  function toggle(slug) {
    return checkClub().then(function (isMember) {
      if (!isMember) {
        var list = readLocal();
        var idx = list.indexOf(slug);
        if (idx === -1) list.push(slug); else list.splice(idx, 1);
        writeLocal(list);
        refreshBadges();
        return idx === -1;
      }
      return isFavorited(slug).then(function (fav) {
        var req = fav
          ? api('/api/club/favorites?slug=' + encodeURIComponent(slug), { method: 'DELETE' })
          : api('/api/club/favorites', { method: 'POST', body: { slug: slug } });
        return req.then(function () { refreshBadges(); return !fav; });
      });
    });
  }

  function mergeGuestFavoritesIntoAccount() {
    var local = readLocal();
    if (!local.length) return Promise.resolve();
    return Promise.all(local.map(function (slug) {
      return api('/api/club/favorites', { method: 'POST', body: { slug: slug } }).catch(function () {});
    })).then(function () {
      writeLocal([]);
      clubStatus = true;
      refreshBadges();
    });
  }

  function refreshBadges() {
    listSlugs().then(function (slugs) {
      document.querySelectorAll('[data-fav-count]').forEach(function (el) {
        el.textContent = String(slugs.length);
        el.hidden = slugs.length === 0;
      });
      document.querySelectorAll('[data-fav-toggle]').forEach(function (btn) {
        var slug = btn.getAttribute('data-fav-toggle');
        btn.classList.toggle('is-favorited', slugs.indexOf(slug) !== -1);
        btn.setAttribute('aria-pressed', slugs.indexOf(slug) !== -1 ? 'true' : 'false');
      });
    });
  }

  function bind(root) {
    (root || document).querySelectorAll('[data-fav-toggle]').forEach(function (btn) {
      if (btn.dataset.favBound) return;
      btn.dataset.favBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var slug = btn.getAttribute('data-fav-toggle');
        btn.disabled = true;
        toggle(slug).then(function (nowFav) {
          btn.disabled = false;
          btn.classList.toggle('is-favorited', nowFav);
          btn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
          if (nowFav) {
            btn.classList.remove('fav-pulse');
            void btn.offsetWidth; // reinicia a animação mesmo se já tinha rodado
            btn.classList.add('fav-pulse');
          }
          if (window.VeriteToast) window.VeriteToast(nowFav ? 'Adicionado aos seus favoritos Verité.' : 'Removido dos favoritos.');
        }).catch(function () { btn.disabled = false; });
      });
    });
    refreshBadges();
  }

  window.VeriteFavorites = {
    listSlugs: listSlugs,
    isFavorited: isFavorited,
    toggle: toggle,
    mergeGuestFavoritesIntoAccount: mergeGuestFavoritesIntoAccount,
    refreshBadges: refreshBadges,
    bind: bind
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bind(document); });
  } else {
    bind(document);
  }
})();
