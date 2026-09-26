/**
 * Progressive enhancement only: fetches admin-managed content/settings/FAQ/SEO
 * and overlays them on top of the static HTML already rendered. Every piece
 * here fails silently back to the existing static text/state if the API is
 * unreachable or a field is empty — the page must look identical to today
 * whenever the backend has nothing new to say.
 */
(function(){
  'use strict';

  function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- Conteúdo ---------- */
  function applyContent(content){
    if(!content) return;
    document.querySelectorAll('[data-content-key]').forEach(function(el){
      var key = el.getAttribute('data-content-key');
      var value = content[key];
      if(value == null || value === '') return;
      if(el.hasAttribute('data-content-html')) el.innerHTML = value;
      else el.textContent = value;
    });
    if(content.manifesto_lines){
      var lines = content.manifesto_lines.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
      var nodes = document.querySelectorAll('#manifesto .manifesto-line');
      if(lines.length === nodes.length){
        nodes.forEach(function(node, i){ node.textContent = lines[i]; });
      }
    }
  }

  /* ---------- Configurações (canais de contato) ---------- */
  function formatPhoneDisplay(raw){
    var d = String(raw).replace(/\D/g, '');
    if(d.length === 13 && d.indexOf('55') === 0){
      return '+55 ' + d.slice(2, 4) + ' ' + d.slice(4, 9) + '-' + d.slice(9);
    }
    if(d.length === 12 && d.indexOf('55') === 0){
      return '+55 ' + d.slice(2, 4) + ' ' + d.slice(4, 8) + '-' + d.slice(8);
    }
    return raw;
  }
  function extractInstagramHandle(url){
    var m = String(url).match(/instagram\.com\/([^/?#]+)/i);
    return m ? '@' + m[1] : url;
  }
  function activateDisabledLi(li, href, displayText){
    li.classList.remove('disabled-link');
    li.removeAttribute('title');
    var icon = li.querySelector('.icon');
    var contentWrap = li.querySelector('span:not(.icon)');
    var value = li.querySelector('.value');
    if(value) value.textContent = displayText;
    var a = document.createElement('a');
    if(icon) a.className = 'contact-link';
    a.href = href;
    if(href.indexOf('http') === 0){ a.target = '_blank'; a.rel = 'noopener'; }
    if(icon) a.appendChild(icon);
    if(contentWrap) a.appendChild(contentWrap);
    if(!icon && !contentWrap) a.textContent = displayText;
    clear(li);
    li.appendChild(a);
  }
  /* Same idea as activateDisabledLi, but for a channel whose static HTML is
     already a real link (e.g. Instagram, hardcoded to the official profile
     as a sane default) — just update href/label in place instead of
     rebuilding the element. Falls back to activateDisabledLi for the older
     "canal em preparação" <li> shape, if that ever comes back. */
  function applyLinkSetting(el, href, displayText){
    if(el.tagName !== 'A'){ activateDisabledLi(el, href, displayText); return; }
    el.classList.remove('disabled-link');
    el.removeAttribute('title');
    el.href = href;
    if(href.indexOf('http') === 0){ el.target = '_blank'; el.rel = 'noopener'; }
    var value = el.querySelector('.value');
    if(value) value.textContent = displayText;
    else {
      /* link de texto simples (rodapé: "Instagram — @perfil"): troca só o
         perfil e mantém o prefixo, senão o texto continuaria mostrando o
         perfil ANTIGO enquanto o href já aponta para o novo */
      var m = el.textContent.match(/^(.*?—\s*)/);
      if(m) el.textContent = m[1] + displayText;
    }
  }
  /* Um canal do rodapé/contato só existe se o painel tiver o valor.
     Esconde o <li> inteiro (ou o próprio elemento, se não estiver numa
     lista), marcando com um atributo próprio para nunca brigar com um
     `hidden` que já viesse do HTML por outro motivo. */
  function esconderSeVazio(chave, valor, aoTerValor){
    document.querySelectorAll('[data-settings-key="' + chave + '"]').forEach(function(el){
      var caixa = el.closest('li') || el;
      if(valor){
        /* o HTML nasce com o item escondido: aparece SÓ quando o painel tem o dado */
        caixa.removeAttribute('data-sem-dado'); caixa.hidden = false;
        aoTerValor(el);
      } else if(!caixa.hasAttribute('data-sem-dado')){
        caixa.setAttribute('data-sem-dado', '');
        caixa.hidden = true;
      }
    });
  }

  function applySettings(settings){
    if(!settings) return;
    if(settings.whatsappNumber){
      var digits = String(settings.whatsappNumber).replace(/\D/g, '');
      document.querySelectorAll('[data-settings-key="whatsapp"]').forEach(function(a){
        a.href = 'https://wa.me/' + digits;
        var valueEl = a.querySelector('.value');
        if(valueEl) valueEl.textContent = formatPhoneDisplay(settings.whatsappNumber);
      });
    }
    /* QUEM MANDA É O PAINEL, inclusive para ESCONDER.
       O Instagram estava escrito à mão no rodapé de todas as páginas
       ("Instagram — @verite.perfumes") e aparecia mesmo com o campo vazio
       no painel. Um canal anunciado que ninguém cadastrou é promessa que o
       site não cumpre. Agora: com valor, mostra o valor do painel; sem
       valor, o item some. E volta sozinho quando for preenchido. */
    esconderSeVazio('instagram', settings.instagramUrl, function(el){
      applyLinkSetting(el, settings.instagramUrl, extractInstagramHandle(settings.instagramUrl));
    });
    esconderSeVazio('email', settings.contactEmail, function(li){
      activateDisabledLi(li, 'mailto:' + settings.contactEmail, settings.contactEmail);
    });
    if(settings.logoUrl){
      document.querySelectorAll('[data-logo="emblem"], [data-logo="full"]').forEach(function(img){
        img.src = settings.logoUrl;
      });
    }
    if(settings.faviconUrl){
      document.querySelectorAll('link[rel="icon"]').forEach(function(link){
        link.href = settings.faviconUrl;
      });
    }
  }

  /* ---------- FAQ ---------- */
  function renderFaq(items){
    var list = document.querySelector('.faq-list');
    if(!list || !items || !items.length) return;
    clear(list);
    items.forEach(function(item, i){
      var n = i + 1;
      var faqItem = document.createElement('div');
      faqItem.className = 'faq-item';

      var h3 = document.createElement('h3');
      var btn = document.createElement('button');
      btn.className = 'faq-trigger';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'faq-a' + n);
      btn.id = 'faq-q' + n;
      var span = document.createElement('span');
      span.textContent = item.question;
      var icon = document.createElement('span');
      icon.className = 'faq-icon';
      icon.setAttribute('aria-hidden', 'true');
      btn.appendChild(span);
      btn.appendChild(icon);
      h3.appendChild(btn);

      var panel = document.createElement('div');
      panel.className = 'faq-panel';
      panel.id = 'faq-a' + n;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', btn.id);
      panel.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('div');
      inner.className = 'faq-panel-inner';
      var p = document.createElement('p');
      p.innerHTML = item.answer; // admin-authored content only, not public user input
      inner.appendChild(p);
      panel.appendChild(inner);

      faqItem.appendChild(h3);
      faqItem.appendChild(panel);
      list.appendChild(faqItem);
    });
    if(window.VeriteBindFaq) window.VeriteBindFaq(list);
  }

  /* ---------- SEO ---------- */
  function applySeo(seo){
    if(!seo) return;
    if(seo.site_title) document.title = seo.site_title;
    if(seo.meta_description){
      var meta = document.querySelector('meta[name="description"]');
      if(meta) meta.setAttribute('content', seo.meta_description);
    }
  }

  function get(path){
    return fetch(path).then(function(res){ return res.ok ? res.json() : null; }).catch(function(){ return null; });
  }

  Promise.all([
    get('/api/public/content'),
    get('/api/public/settings'),
    get('/api/public/faq'),
    get('/api/public/seo')
  ]).then(function(results){
    var contentRes = results[0], settingsRes = results[1], faqRes = results[2], seoRes = results[3];
    if(contentRes && contentRes.ok) applyContent(contentRes.content);
    if(settingsRes && settingsRes.ok) applySettings(settingsRes.settings);
    if(faqRes && faqRes.ok) renderFaq(faqRes.items);
    if(seoRes && seoRes.ok) applySeo(seoRes.seo);
  });
})();
