/**
 * "Descubra sua Verité" — mini-quiz de 3 telas (uma pergunta por vez, com
 * transição suave), pontuando o catálogo já carregado por família olfativa/
 * intensidade/ocasião e recomendando UM produto real no final ("Sua Verité
 * é..."). Sem produto compatível o suficiente, cai no destaque (featured)
 * ou no primeiro publicado — nunca inventa um perfume.
 * Chamado por assets/js/products-loader.js assim que window.VERITE_PRODUCTS chega.
 */
(function(){
  'use strict';

  var QUESTIONS = [
    {
      key: 'familia',
      title: 'Qual estilo combina mais com você?',
      weight: 3,
      field: 'olfactoryFamily',
      options: [
        { label: 'Floral', keywords: ['floral', 'flor', 'jasmim', 'rosa'] },
        { label: 'Amadeirada', keywords: ['amadeirad', 'madeira', 'cedro', 'sândalo', 'sandalo'] },
        { label: 'Cítrica', keywords: ['citric', 'laranja', 'limão', 'limao', 'bergamota'] },
        { label: 'Oriental', keywords: ['oriental', 'especiar', 'âmbar', 'ambar', 'incenso'] },
        { label: 'Doce', keywords: ['doce', 'gourmand', 'baunilha', 'caramelo'] },
        { label: 'Aromática', keywords: ['aromátic', 'aromatic', 'ervas', 'lavanda', 'verde'] }
      ]
    },
    {
      key: 'intensidade',
      title: 'Qual intensidade você prefere?',
      weight: 1,
      field: 'intensity',
      options: [
        { label: 'Leve', keywords: ['leve', 'suave', 'baixa'] },
        { label: 'Moderada', keywords: ['moderad', 'média', 'media'] },
        { label: 'Intensa', keywords: ['intens', 'alta', 'marcante'] }
      ]
    },
    {
      key: 'ocasiao',
      title: 'Em qual ocasião pretende usar?',
      weight: 1,
      field: 'occasion',
      options: [
        { label: 'Dia a dia', keywords: ['dia a dia', 'diario', 'diário', 'casual'] },
        { label: 'Trabalho', keywords: ['trabalho', 'escritorio', 'escritório', 'profissional'] },
        { label: 'Noite', keywords: ['noite', 'noturno'] },
        { label: 'Ocasiões especiais', keywords: ['especial', 'ocasiões especiais', 'festa', 'evento'] }
      ]
    }
  ];

  function init(){
    var root = document.getElementById('quiz-app');
    var stepsWrap = document.getElementById('quiz-steps');
    var progressWrap = document.getElementById('quiz-progress');
    var resultWrap = document.getElementById('quiz-result');
    var resultCard = document.getElementById('quiz-result-card');
    var restartBtn = document.getElementById('quiz-restart');
    if(!root || !stepsWrap || !resultWrap || !resultCard) return;

    var answers = {};
    var current = 0;

    function buildProgress(){
      progressWrap.innerHTML = '';
      QUESTIONS.forEach(function(_, i){
        var dot = document.createElement('span');
        dot.className = 'quiz-progress-dot' + (i === current ? ' is-active' : '') + (i < current ? ' is-done' : '');
        progressWrap.appendChild(dot);
      });
    }

    function buildStep(){
      stepsWrap.innerHTML = '';
      var q = QUESTIONS[current];
      var step = document.createElement('div');
      step.className = 'quiz-step reveal-blur in';
      var h2 = document.createElement('h2');
      h2.textContent = q.title;
      step.appendChild(h2);
      var opts = document.createElement('div');
      opts.className = 'quiz-options';
      q.options.forEach(function(opt){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option';
        btn.textContent = opt.label;
        btn.addEventListener('click', function(){
          answers[q.key] = opt;
          if(current < QUESTIONS.length - 1){
            current += 1;
            buildProgress();
            buildStep();
          } else {
            showResult();
          }
        });
        opts.appendChild(btn);
      });
      step.appendChild(opts);
      if(current > 0){
        var back = document.createElement('button');
        back.type = 'button';
        back.className = 'quiz-back';
        back.textContent = '← Voltar';
        back.addEventListener('click', function(){
          current -= 1;
          buildProgress();
          buildStep();
        });
        step.appendChild(back);
      }
      stepsWrap.appendChild(step);
    }

    function scoreProduct(p){
      var score = 0;
      QUESTIONS.forEach(function(q){
        var chosen = answers[q.key];
        if(!chosen) return;
        var haystack = window.VeriteProducts.normalize(p[q.field] || '');
        if(chosen.keywords.some(function(kw){ return haystack.indexOf(kw) !== -1; })){
          score += q.weight;
        }
      });
      return score;
    }

    function showResult(){
      var VP = window.VeriteProducts;
      var catalog = VP ? VP.all() : [];
      var best = null;
      var bestScore = 0;
      catalog.forEach(function(p){
        var s = scoreProduct(p);
        if(s > bestScore){ bestScore = s; best = p; }
      });
      if(!best) best = catalog.filter(function(p){ return p.featured; })[0] || catalog[0] || null;

      stepsWrap.hidden = true;
      progressWrap.hidden = true;
      resultWrap.hidden = false;
      resultCard.innerHTML = '';

      if(!best){
        var empty = document.createElement('p');
        empty.className = 'quiz-empty';
        empty.textContent = 'Em breve, novas essências Verité para o seu perfil.';
        resultCard.appendChild(empty);
        return;
      }

      var card = document.createElement('div');
      card.className = 'quiz-result-product';
      var media = document.createElement('div');
      media.className = 'quiz-result-media';
      if(best.images && best.images[0]){
        var img = document.createElement('img');
        img.src = best.images[0]; img.alt = best.name || ''; img.loading = 'lazy';
        media.appendChild(img);
      }
      card.appendChild(media);

      var info = document.createElement('div');
      info.className = 'quiz-result-info';
      if(best.olfactoryFamily) info.appendChild(elText('p', 'eyebrow', best.olfactoryFamily));
      info.appendChild(elText('h4', null, best.name || ''));
      if(best.shortDescription) info.appendChild(elText('p', 'quiz-result-desc', best.shortDescription));
      if(best.price != null) info.appendChild(elText('p', 'quiz-result-price', VP.money(best.salePrice != null ? best.salePrice : best.price, best.currency)));

      var actions = document.createElement('div');
      actions.className = 'quiz-result-actions';
      var viewBtn = document.createElement('a');
      viewBtn.className = 'btn btn-ghost';
      viewBtn.href = 'produto.html?slug=' + encodeURIComponent(best.slug || best.id);
      viewBtn.textContent = 'Conhecer Perfume';
      actions.appendChild(viewBtn);
      if(best.price != null && best.inStock !== false){
        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn';
        addBtn.textContent = 'Adicionar ao Carrinho';
        addBtn.setAttribute('data-add-to-cart', JSON.stringify({
          slug: best.slug || best.id, name: best.name, price: best.price,
          salePrice: best.salePrice, volume: best.volume, images: best.images
        }));
        actions.appendChild(addBtn);
      }
      info.appendChild(actions);
      card.appendChild(info);
      resultCard.appendChild(card);

      if(window.VeriteCart) window.VeriteCart.bind(resultCard);
    }

    function elText(tag, className, text){
      var n = document.createElement(tag);
      if(className) n.className = className;
      n.textContent = text;
      return n;
    }

    if(restartBtn){
      restartBtn.addEventListener('click', function(){
        answers = {};
        current = 0;
        resultWrap.hidden = true;
        stepsWrap.hidden = false;
        progressWrap.hidden = false;
        buildProgress();
        buildStep();
      });
    }

    buildProgress();
    buildStep();
  }

  window.VeriteQuiz = { init: init };
})();
