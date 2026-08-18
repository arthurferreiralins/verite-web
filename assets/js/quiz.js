/**
 * "Qual Verité combina com você?" — mini-teste na home. Uma pergunta,
 * seis perfis olfativos; a escolha filtra o catálogo já carregado por
 * palavras-chave (família olfativa + descrição). Sem produto compatível
 * ainda, cai nos destaques (featured) em vez de ficar vazio.
 * Chamado por assets/js/products-loader.js assim que window.VERITE_PRODUCTS chega.
 */
(function(){
  'use strict';

  var PROFILES = [
    { slug:'doce', label:'Doce', keywords:['doce','gourmand','baunilha','caramelo'] },
    { slug:'amadeirada', label:'Amadeirada', keywords:['amadeirad','madeira','cedro','sândalo','sandalo'] },
    { slug:'floral', label:'Floral', keywords:['floral','flor','jasmim','rosa'] },
    { slug:'citrica', label:'Cítrica', keywords:['citric','laranja','limão','limao','bergamota'] },
    { slug:'intensa', label:'Intensa', keywords:['intens','oriental','especiar','âmbar','ambar'] },
    { slug:'refrescante', label:'Refrescante', keywords:['fresc','aquátic','aquatic','marinho','verde'] }
  ];

  function init(){
    var root = document.getElementById('quiz');
    if(!root) return;
    var optionsWrap = document.getElementById('quiz-options');
    var resultWrap = document.getElementById('quiz-result');
    var resultGrid = document.getElementById('quiz-result-grid');
    var resultTitle = document.getElementById('quiz-result-title');
    var restartBtn = document.getElementById('quiz-restart');
    if(!optionsWrap || !resultWrap || !resultGrid) return;

    optionsWrap.innerHTML = '';
    PROFILES.forEach(function(profile){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      btn.textContent = profile.label;
      btn.addEventListener('click', function(){ showResult(profile); });
      optionsWrap.appendChild(btn);
    });

    function showResult(profile){
      var VP = window.VeriteProducts;
      var catalog = VP ? VP.all() : [];
      var normalize = VP ? VP.normalize : function(s){ return String(s||'').toLowerCase(); };
      var matches = catalog.filter(function(p){
        var haystack = normalize([p.olfactoryFamily, p.shortDescription, p.description].join(' '));
        return profile.keywords.some(function(kw){ return haystack.indexOf(kw) !== -1; });
      });
      var usedFallback = false;
      if(!matches.length){
        matches = catalog.filter(function(p){ return p.featured; });
        usedFallback = true;
      }

      optionsWrap.hidden = true;
      root.querySelector('.quiz-intro').hidden = true;
      resultWrap.hidden = false;
      if(resultTitle){
        resultTitle.textContent = matches.length
          ? (usedFallback ? 'Enquanto preparamos um ' + profile.label.toLowerCase() + ' perfeito, conheça nossos destaques:' : 'Perfumes Verité para o seu perfil ' + profile.label.toLowerCase() + ':')
          : 'Em breve, novas essências para o seu perfil ' + profile.label.toLowerCase() + '.';
      }
      if(matches.length && VP){
        VP.renderGrid(resultGrid, matches.slice(0, 4));
        resultGrid.hidden = false;
      } else {
        resultGrid.hidden = true;
      }
    }

    if(restartBtn){
      restartBtn.addEventListener('click', function(){
        resultWrap.hidden = true;
        optionsWrap.hidden = false;
        root.querySelector('.quiz-intro').hidden = false;
      });
    }
  }

  window.VeriteQuiz = { init: init };
})();
