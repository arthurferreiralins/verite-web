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
    if(settings.instagramUrl){
      document.querySelectorAll('[data-settings-key="instagram"]').forEach(function(li){
        activateDisabledLi(li, settings.instagramUrl, extractInstagramHandle(settings.instagramUrl));
      });
    }
    if(settings.contactEmail){
      document.querySelectorAll('[data-settings-key="email"]').forEach(function(li){
        activateDisabledLi(li, 'mailto:' + settings.contactEmail, settings.contactEmail);
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
