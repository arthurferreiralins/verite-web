/* =====================================================================
   DADOS LEGAIS DA VERITÉ — fonte única
   ---------------------------------------------------------------------
   Preencha os quatro campos abaixo UMA vez e eles aparecem sozinhos em:
     - rodapé de todas as páginas (linha discreta)
     - termos.html   (seção "Identificação")
     - privacidade.html (seção "Controlador dos dados")
     - sobre.html    (bloco de contato)

   Enquanto um campo estiver `null`, o site NÃO inventa nada e NÃO mostra
   "[PREENCHER: ...]" para o cliente: a linha do rodapé simplesmente não
   aparece e as páginas legais mantêm a frase honesta de "ainda não
   definido". Para ver o que falta, abra qualquer página com ?fills=1 —
   os campos vazios aparecem marcados em dourado tracejado, igual aos
   campos de produto (ver .fill-pending em assets/css/style.css).

   O e-mail também pode vir do painel (Configurações → contato), via
   /api/public/settings; quando vier de lá, ele ganha do valor daqui.
   ===================================================================== */
window.VERITE_EMPRESA = {
  razaoSocial: null, // [PREENCHER: RAZÃO SOCIAL] — ex.: "Fulana de Tal Comércio de Perfumes LTDA"
  cnpj:        null, // [PREENCHER: CNPJ] — ex.: "00.000.000/0001-00"
  endereco:    null, // [PREENCHER: ENDEREÇO COMPLETO] — rua, nº, bairro, cidade/UF, CEP
  email:       null  // [PREENCHER: E-MAIL DE CONTATO] — ex.: "contato@veriteperfumes.com.br"
};

(function(){
  'use strict';

  var ROTULOS = {
    razaoSocial: '[PREENCHER: RAZÃO SOCIAL]',
    cnpj: '[PREENCHER: CNPJ]',
    endereco: '[PREENCHER: ENDEREÇO COMPLETO]',
    email: '[PREENCHER: E-MAIL DE CONTATO]'
  };

  function dados(){ return window.VERITE_EMPRESA || {}; }
  function valor(campo){
    var v = dados()[campo];
    return (typeof v === 'string' && v.trim()) ? v.trim() : null;
  }

  function marcador(campo){
    var span = document.createElement('span');
    span.className = 'fill-pending';
    span.setAttribute('data-fill', ROTULOS[campo] || '[PREENCHER]');
    return span;
  }

  /* Campos avulsos: <span data-empresa="cnpj"></span> */
  function preencherCampos(raiz){
    (raiz || document).querySelectorAll('[data-empresa]').forEach(function(el){
      var campo = el.getAttribute('data-empresa');
      var v = valor(campo);
      while(el.firstChild) el.removeChild(el.firstChild);
      if(v){
        el.textContent = v;
        el.removeAttribute('hidden');
      } else {
        el.appendChild(marcador(campo));
      }
    });
  }

  /* Linha do rodapé: só existe quando há ao menos um dado real. Monta o
     texto com o que estiver preenchido, na ordem razão social · CNPJ ·
     endereço, sem deixar separador solto. */
  function preencherRodape(){
    var partes = ['razaoSocial', 'cnpj', 'endereco']
      .map(function(c){ return c === 'cnpj' && valor(c) ? 'CNPJ ' + valor(c) : valor(c); })
      .filter(Boolean);

    document.querySelectorAll('[data-empresa-linha]').forEach(function(el){
      while(el.firstChild) el.removeChild(el.firstChild);
      if(partes.length){
        el.textContent = partes.join(' · ');
        el.hidden = false;
        return;
      }
      /* nada preenchido: invisível para o cliente, visível em ?fills=1 */
      el.hidden = false;
      ['razaoSocial', 'cnpj', 'endereco'].forEach(function(c, i){
        if(i) el.appendChild(document.createTextNode(' '));
        el.appendChild(marcador(c));
      });
      if(!document.documentElement.classList.contains('show-fills')) el.hidden = true;
    });
  }

  /* Páginas legais: o parágrafo "ainda não definido" some assim que os
     dados reais existirem, dando lugar a eles. */
  function preencherBlocosLegais(){
    document.querySelectorAll('[data-empresa-legal]').forEach(function(el){
      var temTudo = valor('razaoSocial') && valor('cnpj') && valor('endereco');
      var pendente = el.querySelector('[data-empresa-pendente]');
      var pronto = el.querySelector('[data-empresa-pronto]');
      if(pendente) pendente.hidden = !!temTudo;
      if(pronto) pronto.hidden = !temTudo;
    });
  }

  /* Contato em sobre.html: o item nasce como "Canal em preparação" e o
     site-data.js já o ativa quando o painel tem um e-mail cadastrado
     (/api/public/settings). Isto aqui é o caminho alternativo — quando o
     e-mail vive só neste arquivo de config. Se o painel responder depois,
     ele sobrescreve, e tudo bem: é o mesmo dado. */
  function preencherContato(){
    var email = valor('email');
    if(!email) return;
    document.querySelectorAll('[data-settings-key="email"].disabled-link').forEach(function(li){
      var alvo = li.querySelector('.value');
      if(!alvo) return;
      li.classList.remove('disabled-link');
      li.removeAttribute('title');
      while(alvo.firstChild) alvo.removeChild(alvo.firstChild);
      var a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = email;
      alvo.appendChild(a);
    });
  }

  function aplicar(){
    preencherCampos();
    preencherRodape();
    preencherBlocosLegais();
    preencherContato();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', aplicar);
  } else {
    aplicar();
  }

  /* exposto para o site-data.js reaplicar caso o painel mande um e-mail */
  window.VeriteEmpresa = { aplicar: aplicar, valor: valor };
})();
