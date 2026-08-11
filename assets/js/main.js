(function(){
  'use strict';

  /* Mobile nav toggle */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if(toggle && nav){
    toggle.addEventListener('click', function(){
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Header gains a denser look once the hero has scrolled past */
  var header = document.querySelector('header');
  if(header){
    var onScroll = function(){
      header.classList.toggle('is-scrolled', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
  }

  /* Highlight the nav link matching the section currently in view */
  var navLinks = nav ? Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]')) : [];
  if(navLinks.length && 'IntersectionObserver' in window){
    var linkFor = {};
    navLinks.forEach(function(a){ linkFor[a.getAttribute('href').slice(1)] = a; });
    var sectionObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var link = linkFor[entry.target.id];
        if(!link) return;
        if(entry.isIntersecting){
          navLinks.forEach(function(a){ a.classList.remove('is-active'); });
          link.classList.add('is-active');
        }
      });
    }, {rootMargin:'-45% 0px -50% 0px'});
    Object.keys(linkFor).forEach(function(id){
      var el = document.getElementById(id);
      if(el) sectionObserver.observe(el);
    });
  }

  /* FAQ accordion — plain button + aria-expanded, no accordion library.
     Exposed on window so a data loader can re-bind it after replacing
     .faq-list with content fetched from the admin panel. */
  function bindFaqAccordion(root){
    (root || document).querySelectorAll('.faq-trigger').forEach(function(btn){
      btn.addEventListener('click', function(){
        var item = btn.closest('.faq-item');
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if(panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      });
    });
  }
  bindFaqAccordion(document);
  window.VeriteBindFaq = bindFaqAccordion;

  /* Nossa Essência: whichever value is crossing the vertical center of the
     viewport gets individual emphasis, so each word gets its own moment
     as the user scrolls through the list instead of five equal cards */
  var essenciaItems = document.querySelectorAll('.essencia-item');
  if(essenciaItems.length && 'IntersectionObserver' in window){
    var focusObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        entry.target.classList.toggle('is-focused', entry.isIntersecting);
      });
    }, {rootMargin:'-45% 0px -45% 0px'});
    essenciaItems.forEach(function(el){ focusObserver.observe(el); });
  }

  /* Scroll-in reveal, staggered within any shared parent via CSS nth-child delays.
     Exposed on window so a data loader can bind freshly-injected .reveal
     elements (e.g. FAQ items rebuilt from the admin panel) — without this,
     anything added after this initial pass would stay invisible forever
     since :where(html.js) .reveal starts at opacity:0. */
  var revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {threshold:.15, rootMargin:'0px 0px -60px 0px'}) : null;

  function bindReveal(root){
    var items = (root || document).querySelectorAll('.reveal, .reveal-blur');
    if(revealObserver){
      items.forEach(function(el){ revealObserver.observe(el); });
    } else {
      items.forEach(function(el){ el.classList.add('in'); });
    }
  }
  bindReveal(document);
  window.VeriteBindReveal = bindReveal;

  /* Waitlist + contact forms submit for real to /api/public/* now.
     Validation/loading/success states stay exactly the same as before —
     only what happens between "loading" and "success" changed (a real
     fetch instead of a simulated delay), plus a graceful inline error
     state for the network-failure path that never existed while this
     was fake. */
  document.querySelectorAll('form[data-submit-endpoint]').forEach(function(form){
    var generalError = form.querySelector('.form-error-general');

    form.querySelectorAll('input, textarea').forEach(function(input){
      input.addEventListener('input', function(){
        var field = input.closest('.field');
        if(field) field.classList.remove('is-invalid');
      });
    });

    form.addEventListener('submit', function(e){
      e.preventDefault();

      var valid = true;
      var firstInvalid = null;
      form.querySelectorAll('[required]').forEach(function(input){
        var field = input.closest('.field');
        var ok = input.checkValidity();
        if(field){
          field.classList.toggle('is-invalid', !ok);
          var err = field.querySelector('.field-error');
          if(err){
            err.textContent = ok ? '' :
              (input.validity.valueMissing ? 'Este campo é obrigatório.' : 'Verifique o formato deste campo.');
          }
        }
        if(!ok){
          valid = false;
          if(!firstInvalid) firstInvalid = input;
        }
      });
      if(!valid){
        if(firstInvalid) firstInvalid.focus();
        return;
      }

      if(generalError){ generalError.hidden = true; generalError.textContent = ''; }
      var btn = form.querySelector('button[type="submit"]');
      if(btn) btn.classList.add('is-loading');

      var payload = {};
      new FormData(form).forEach(function(value, key){ payload[key] = value; });

      fetch(form.getAttribute('data-submit-endpoint'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      }).then(function(res){
        return res.json().catch(function(){ return {}; }).then(function(data){
          return {res: res, data: data};
        });
      }).then(function(result){
        if(btn) btn.classList.remove('is-loading');
        if(!result.res.ok || !result.data || result.data.ok !== true){
          throw new Error((result.data && result.data.error) || 'Não foi possível enviar agora. Tente novamente.');
        }
        var container = form.closest('[data-form-container]') || form.parentElement;
        container.classList.add('is-sent');
      }).catch(function(err){
        if(btn) btn.classList.remove('is-loading');
        if(generalError){
          generalError.textContent = err.message || 'Não foi possível enviar agora. Tente novamente.';
          generalError.hidden = false;
        }
      });
    });
  });

  /* Floating WhatsApp button — injected on every page so a single change
     here updates all of them. Number is the real one already published
     in Contato/rodapé (5581981553632); this just makes it reachable from
     anywhere on the page, not only after scrolling to the footer. */
  var waLink = document.createElement('a');
  waLink.className = 'whatsapp-float';
  waLink.href = 'https://wa.me/5581981553632?text=' + encodeURIComponent('Olá! Vim pelo site da VERITÉ e gostaria de saber mais.');
  waLink.target = '_blank';
  waLink.rel = 'noopener';
  waLink.setAttribute('aria-label', 'Falar com a VERITÉ no WhatsApp');
  waLink.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.44 1.32 4.94L2.05 22l5.29-1.39a9.9 9.9 0 0 0 4.7 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.13-2.9-7C17.19 3.03 14.7 2 12.04 2Zm5.83 14.16c-.24.68-1.4 1.3-1.93 1.38-.49.08-1.11.11-1.79-.11-.41-.13-.94-.31-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09.99-2.37.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.14-.3.3-.13.59.17.29.75 1.24 1.61 2 1.11.99 2.04 1.3 2.34 1.44.3.14.47.12.65-.07.18-.19.75-.87.95-1.17.2-.3.4-.24.66-.14.27.1 1.69.8 1.98.94.29.14.48.21.55.33.07.12.07.68-.17 1.36Z"/></svg>';
  document.body.appendChild(waLink);
})();
