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

  /* Scroll-in reveal, staggered within any shared parent via CSS nth-child delays */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, {threshold:.15, rootMargin:'0px 0px -60px 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); });
  }

  /* Forms are front-end only for now — no email service wired up yet.
     Each just swaps its container into a thank-you state. */
  document.querySelectorAll('[data-fake-submit]').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var container = form.closest('[data-form-container]') || form.parentElement;
      container.classList.add('is-sent');
    });
  });
})();
