/**
 * Pointer-reactive polish — custom gold cursor (dot + trailing ring that
 * grows over interactive elements), a soft spotlight that follows the
 * mouse inside buttons and the hero/page-hero ambient layer, and a subtle
 * tilt on product cards. All opt-in: bails out completely on touch/coarse
 * pointers and prefers-reduced-motion, so nothing here ever fights a
 * device that doesn't have a real mouse.
 */
(function(){
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if(reduceMotion || !finePointer) return;

  document.addEventListener('DOMContentLoaded', function(){
    initCursor();
    initButtonSpotlight();
    initCardTilt();
    initHeroGlow();
    initHeroLogoTilt();
  });

  function initCursor(){
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    var ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.documentElement.classList.add('has-custom-cursor');

    var tx = -100, ty = -100, rx = -100, ry = -100, shown = false;

    function onMove(e){
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%)';
      if(!shown){
        shown = true;
        dot.classList.add('is-visible');
        ring.classList.add('is-visible');
      }
    }
    document.addEventListener('mousemove', onMove, {passive:true});
    document.addEventListener('mouseleave', function(){
      dot.classList.remove('is-visible');
      ring.classList.remove('is-visible');
    });
    document.addEventListener('mouseenter', function(){
      if(shown){ dot.classList.add('is-visible'); ring.classList.add('is-visible'); }
    });

    function loop(){
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    var hoverSelector = 'a, button, .btn, .produto-card, .product-tile, .category-empty, input, textarea, .nav-toggle, .field';
    document.addEventListener('mouseover', function(e){
      if(e.target.closest && e.target.closest(hoverSelector)) ring.classList.add('is-active');
    });
    document.addEventListener('mouseout', function(e){
      if(e.target.closest && e.target.closest(hoverSelector)) ring.classList.remove('is-active');
    });
  }

  function initButtonSpotlight(){
    document.querySelectorAll('.btn').forEach(function(btn){
      btn.addEventListener('mousemove', function(e){
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--bx', (e.clientX - r.left) + 'px');
        btn.style.setProperty('--by', (e.clientY - r.top) + 'px');
      });
    });
  }

  function initCardTilt(){
    document.querySelectorAll('.produto-card, .product-tile-media').forEach(function(card){
      card.addEventListener('mousemove', function(e){
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(700px) translateY(-6px) rotateX(' + (py * -6).toFixed(2) + 'deg) rotateY(' + (px * 8).toFixed(2) + 'deg)';
      });
      card.addEventListener('mouseleave', function(){ card.style.transform = ''; });
    });
  }

  /* Extremely subtle tilt on the hero lockup image only — not the
     .emblem-wrap-full wrapper, which already owns the emblem-float
     keyframe. A CSS animation re-asserts `transform` every frame, so an
     inline transform set here on the same element would just get fought
     and never actually show; the <img> inside has no animation of its
     own, so it's free to take the pointer-driven transform cleanly. */
  function initHeroLogoTilt(){
    var hero = document.querySelector('.hero');
    var img = hero && hero.querySelector('.emblem-wrap-full img');
    if(!hero || !img) return;
    hero.addEventListener('mousemove', function(e){
      var r = hero.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      img.style.transform = 'perspective(900px) rotateX(' + (py * -3).toFixed(2) + 'deg) rotateY(' + (px * 4).toFixed(2) + 'deg)';
    });
    hero.addEventListener('mouseleave', function(){ img.style.transform = ''; });
  }

  function initHeroGlow(){
    document.querySelectorAll('.hero, .page-hero').forEach(function(section){
      var glow = section.querySelector('.ambient-cursor');
      if(!glow) return;
      section.addEventListener('mousemove', function(e){
        var r = section.getBoundingClientRect();
        glow.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        glow.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }
})();
