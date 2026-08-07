/**
 * Ambient background system — populates .ambient-particles containers with
 * randomized .mote spans (small drifting gold dots) and drives a light,
 * rAF-throttled scroll parallax for [data-parallax] layers.
 *
 * Deliberately not a canvas/rAF particle sim: each mote is a plain CSS
 * animation (transform + opacity only), so once the custom properties
 * below are set on load, the browser's compositor handles everything —
 * no per-frame JS cost, no matter how many motes exist on the page.
 */
(function(){
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isNarrow = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function populateMotes(){
    if(reduceMotion) return;
    document.querySelectorAll('.ambient-particles').forEach(function(field){
      var requested = parseInt(field.getAttribute('data-count'), 10) || 10;
      var count = isNarrow ? Math.max(4, Math.round(requested * 0.5)) : requested;
      var frag = document.createDocumentFragment();
      for(var i = 0; i < count; i++){
        var mote = document.createElement('span');
        mote.className = 'mote';
        mote.style.setProperty('--mx', rand(4, 96) + '%');
        mote.style.setProperty('--my', rand(6, 94) + '%');
        mote.style.setProperty('--ms', rand(1.5, 3.4).toFixed(1) + 'px');
        mote.style.setProperty('--md', rand(12, 24).toFixed(1) + 's');
        mote.style.setProperty('--mdl', rand(0, 14).toFixed(1) + 's');
        mote.style.setProperty('--mdx', rand(-24, 24).toFixed(0) + 'px');
        mote.style.setProperty('--mdy', rand(-70, -30).toFixed(0) + 'px');
        frag.appendChild(mote);
      }
      field.appendChild(frag);
    });
  }

  function initParallax(){
    if(reduceMotion) return;
    var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if(!layers.length) return;

    var ticking = false;
    function apply(){
      layers.forEach(function(layer){
        var rect = layer.parentElement.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        // progress: -1 (section just below viewport) .. 1 (just above), 0 centered
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        var strength = parseFloat(layer.getAttribute('data-parallax')) || 18;
        layer.style.transform = 'translate3d(0,' + (progress * strength).toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    function onScroll(){
      if(!ticking){
        window.requestAnimationFrame(apply);
        ticking = true;
      }
    }
    apply();
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onScroll, {passive:true});
  }

  document.addEventListener('DOMContentLoaded', function(){
    populateMotes();
    initParallax();
  });
})();
