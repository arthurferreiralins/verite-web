/**
 * lab-refresh.js — só é carregado por index-lab.html.
 * Micro-interações novas que complementam (sem substituir) hero-banner.js,
 * scroll-fx.js, pointer.js e main.js: nada aqui repete o que já existe.
 */
(function(){
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fineHover = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* 7) Animações — atração magnética sutil nos botões principais do herói
     e das seções (hb-cta, .btn). O botão se desloca um pouco na direção
     do cursor enquanto ele está por perto, e volta ao centro ao sair. */
  if(!reduceMotion && fineHover){
    var magnets = document.querySelectorAll('.hb-cta, .hero-cta .btn, #clube-home .btn');
    magnets.forEach(function(el){
      el.classList.add('is-magnetic');
      var strength = 14;
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var mx = ((e.clientX - r.left) / r.width - .5) * strength;
        var my = ((e.clientY - r.top) / r.height - .5) * strength;
        el.style.setProperty('--mx', mx.toFixed(1) + 'px');
        el.style.setProperty('--my', my.toFixed(1) + 'px');
      });
      el.addEventListener('mouseleave', function(){
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }

  /* 10) Mobile — véu escuro atrás do menu principal quando aberto, que
     fecha o menu ao ser tocado (hoje só fechava clicando num link). */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if(toggle && nav){
    var backdrop = document.createElement('div');
    backdrop.className = 'lab-nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    function sync(){
      backdrop.classList.toggle('is-visible', nav.classList.contains('is-open'));
    }
    var mo = new MutationObserver(sync);
    mo.observe(nav, {attributes:true, attributeFilter:['class']});
    backdrop.addEventListener('click', function(){
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  /* 1) Banner — variante mais escura do líquido do frasco Feminino (só
     no rascunho, arquivo novo assets/img/frasco-feminino-lab-escuro.png,
     a foto oficial não foi alterada). hero-banner.js troca bottle.src ao
     alternar fragrância usando o caminho original em FRAGS; como esse
     array vive dentro do próprio hero-banner.js (não dá pra editar sem
     tocar no arquivo de produção), interceptamos a troca de src aqui e
     trocamos de volta pra variante escura sempre que ela apontar pro
     Feminino original — assim a cor se mantém mesmo depois de o
     visitante trocar de fragrância e voltar pro Feminino. */
  var hbBottleImg = document.querySelector('#inicio .hb-bottle');
  if(hbBottleImg){
    var HB_FEMININO_ORIGINAL = 'assets/img/frasco-feminino.png';
    var HB_FEMININO_ESCURO = 'assets/img/frasco-feminino-lab-escuro.png';
    var swappingBottle = false;
    function hbSwapDarkFeminino(){
      if(swappingBottle) return;
      if(hbBottleImg.getAttribute('src') === HB_FEMININO_ORIGINAL){
        swappingBottle = true;
        hbBottleImg.setAttribute('src', HB_FEMININO_ESCURO);
        swappingBottle = false;
      }
    }
    new MutationObserver(hbSwapDarkFeminino).observe(hbBottleImg, {attributes:true, attributeFilter:['src']});
  }

  /* 1) Banner — a capa agora abre no Verité Eau de Parfum (masculino,
     data-i="2") em vez do Feminino (data-i="0"), mas o estado interno
     de hero-banner.js (a variável `cur`) começa sempre em 0, hardcoded
     lá dentro — não dá pra mudar isso sem editar o arquivo de produção.
     Corrigimos simulando um clique real no botão do masculino assim que
     a entrada do herói começa (.hb-ready), o que já acontece por trás
     de ~1s de opacidade zero em .hb-bottle-enter — a troca inteira
     (paint + transição) termina bem antes disso, então fica invisível.
     Sem essa correção, o primeiro clique no ponto do Feminino não faria
     nada (o código acharia que o Feminino já é o atual). */
  var hbHeroForSync = document.querySelector('#inicio.hero-home');
  var hbMasculinoBtn = hbHeroForSync && hbHeroForSync.querySelector('.hb-switch-btn[data-i="2"]');
  if(hbHeroForSync && hbMasculinoBtn){
    var hbSynced = false;
    function hbSyncToMasculino(){
      if(hbSynced) return;
      hbSynced = true;
      hbMasculinoBtn.click();
    }
    if(hbHeroForSync.classList.contains('hb-ready')){
      hbSyncToMasculino();
    } else {
      var hbReadyObserver = new MutationObserver(function(){
        if(hbHeroForSync.classList.contains('hb-ready')){
          hbReadyObserver.disconnect();
          hbSyncToMasculino();
        }
      });
      hbReadyObserver.observe(hbHeroForSync, {attributes:true, attributeFilter:['class']});
    }
  }

  /* 1) Banner — setas de navegação ao lado do frasco, além dos pontinhos.
     Não acessam nada interno de hero-banner.js — descobrem a fragrância
     atual pelo botão .is-active (sempre correto, venha a troca de onde
     vier) e simulam um clique real no próximo/anterior. */
  var hbArrowHero = document.querySelector('#inicio.hero-home');
  if(hbArrowHero){
    var hbArrowBtns = Array.prototype.slice.call(hbArrowHero.querySelectorAll('.hb-switch-btn'));
    function hbStep(dir){
      if(!hbArrowBtns.length) return;
      var activeBtn = hbArrowHero.querySelector('.hb-switch-btn.is-active') || hbArrowBtns[0];
      var idx = parseInt(activeBtn.getAttribute('data-i'), 10) || 0;
      var next = (idx + dir + hbArrowBtns.length) % hbArrowBtns.length;
      hbArrowBtns[next].click();
    }
    var hbPrev = hbArrowHero.querySelector('.hb-nav-prev');
    var hbNext = hbArrowHero.querySelector('.hb-nav-next');
    if(hbPrev) hbPrev.addEventListener('click', function(){ hbStep(-1); });
    if(hbNext) hbNext.addEventListener('click', function(){ hbStep(1); });
  }

  /* 1) Banner — saída cinematográfica ao rolar. Grava --hb-exit (0→1)
     em #inicio conforme o herói sai de cena; o CSS (lab-refresh.css)
     usa essa variável pra esmaecer/recuar .hb-inner e .hb-dock. Não
     toca em nenhum elemento [data-hb-depth] nem .hb-bottle-tilt, então
     não disputa transform com o parallax/tilt de hero-banner.js. */
  var hbHero = document.querySelector('#inicio.hero-home');
  if(hbHero && !reduceMotion){
    var hbTicking = false;
    function hbUpdate(){
      hbTicking = false;
      var r = hbHero.getBoundingClientRect();
      var p = -r.top / (r.height * 0.9);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      hbHero.style.setProperty('--hb-exit', p.toFixed(3));
    }
    window.addEventListener('scroll', function(){
      if(!hbTicking){ hbTicking = true; window.requestAnimationFrame(hbUpdate); }
    }, {passive:true});
    window.addEventListener('resize', function(){
      if(!hbTicking){ hbTicking = true; window.requestAnimationFrame(hbUpdate); }
    }, {passive:true});
    hbUpdate();
  }

  /* 11) Acabamento premium — fade-in das imagens lazy (frag-grid, reel,
     miniaturas) assim que cada uma termina de carregar, em vez de
     aparecerem de repente. O frasco principal do banner não usa
     loading="lazy", então nunca é afetado por isto. */
  document.querySelectorAll('main img[loading="lazy"]').forEach(function(img){
    if(img.complete && img.naturalWidth){ img.classList.add('is-loaded'); return; }
    img.addEventListener('load', function(){ img.classList.add('is-loaded'); });
    img.addEventListener('error', function(){ img.classList.add('is-loaded'); });
  });
})();
