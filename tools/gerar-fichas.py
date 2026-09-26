# -*- coding: utf-8 -*-
"""Gera as 4 fichas "em breve" (perfume-*.html) a partir de produtos.html.

    python tools/gerar-fichas.py

POR QUE HTML ESTATICO GERADO, e nao uma pagina unica montada por JS: as
fichas sao paginas de conteudo que buscadores devem indexar (cada uma com o
proprio title/description). Montadas por JS elas chegariam vazias ao
crawler. Gerar a partir de produtos.html garante que cabecalho, menu,
rodape e scripts sejam SEMPRE os mesmos do resto do site — se o cabecalho
mudar, basta rodar o script de novo.

SO DADOS REAIS. A lista PERFUMES abaixo e a mesma de assets/js/perfumes-dados.js
(nome, volume, foto e a frase de cada sala da home). Nenhuma nota olfativa,
preco ou descricao inventada. O script confere as duas listas e avisa se
divergirem.
"""
import io
import json
import os
import re
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BASE = 'https://veriteperfumes.com.br'

PERFUMES = [
    dict(slug='feminino', ficha='perfume-feminino.html', nome='Verité Feminino', h1='Verité <em>Feminino</em>',
         volume='Eau de Parfum · 50 ml', frase='Sofisticação sem excesso.',
         img='assets/img/frasco-feminino.webp', w=540, h=725, chave='feminino'),
    dict(slug='masculino', ficha='perfume-masculino.html', nome='Verité Masculino', h1='Verité <em>Masculino</em>',
         volume='Eau de Parfum · 40 ml', frase='Uma presença que fica.',
         img='assets/img/frasco-verite-hero.webp', w=263, h=481, chave='masculino'),
    dict(slug='dorea', ficha='perfume-dorea.html', nome='Verité Doréa', h1='Verité <em>Doréa</em>',
         volume='Eau de Parfum · 30 ml', frase='Única, como você.',
         img='assets/img/frasco-dorea.webp', w=560, h=840, chave='dorea'),
    dict(slug='kit', ficha='perfume-kit.html', nome='Kit Verité', h1='Kit <em>Verité</em>',
         volume='30 ml · 50 ml · 20 ml',
         frase='Três frascos numa caixa. Para presentear, ou para começar a sua coleção.',
         img='assets/img/frasco-kits.webp', w=760, h=570, chave='kit', largo=True),
]


def ler(rel):
    with io.open(os.path.join(RAIZ, rel), encoding='utf-8', newline='') as fh:
        return fh.read()


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;'))


def conferir_dados_js():
    """A lista deste script tem de bater com a de perfumes-dados.js."""
    js = ler('assets/js/perfumes-dados.js')
    ok = True
    for p in PERFUMES:
        for campo in ('nome', 'volume', 'frase', 'img', 'ficha'):
            if p[campo] not in js:
                print('  AVISO: "%s" (%s) nao consta em perfumes-dados.js' % (p[campo], p['slug']))
                ok = False
    return ok


def cartao(p, cls='h-embreve-card'):
    """Cartao de perfume (vitrine de produtos.html e 'conheca tambem')."""
    return (
        '<a class="%s" href="%s" data-perfume="%s">\n'
        '  <span class="h-ec-media%s"><img src="%s" alt="Frasco %s" width="%d" height="%d" loading="lazy" decoding="async" draggable="false"/></span>\n'
        '  <span class="h-ec-selo">Em breve</span>\n'
        '  <span class="h-ec-nome">%s</span>\n'
        '  <span class="h-ec-vol">%s</span>\n'
        '  <span class="h-ec-cta">Ver ficha <span aria-hidden="true">&rarr;</span></span>\n'
        '</a>'
    ) % (cls, p['ficha'], p['slug'], ' wide' if p.get('largo') else '', p['img'], esc(p['nome']),
         p['w'], p['h'], esc(p['nome']), esc(p['volume']))


def main_da_ficha(p):
    outros = [q for q in PERFUMES if q['slug'] != p['slug']]
    cards = '\n'.join('      ' + cartao(q).replace('\n', '\n      ') for q in outros)
    return '''<main>

  <!-- ============ Ficha "em breve" — %(nome)s ============
       Gerada por tools/gerar-fichas.py a partir de produtos.html. Só dados
       reais (nome, volume, foto e a frase da sala da home). Quando o produto
       for publicado no painel, perfume-ficha.js troca o formulário por um
       link para o produto de verdade. -->
  <section id="topo" class="h-pagehero h-ficha" data-perfume-slug="%(slug)s" aria-labelledby="ficha-titulo">
    <i class="h-ph-glow" aria-hidden="true"></i>
    <div class="h-ficha-in">
      <div class="h-ficha-foto rv%(largo)s">
        <i class="h-ficha-halo" aria-hidden="true"></i>
        <img src="%(img)s" alt="Frasco %(nome_esc)s, %(volume_esc)s" width="%(w)d" height="%(h)d" fetchpriority="high" decoding="async" draggable="false"/>
        <i class="h-ficha-piso" aria-hidden="true"></i>
      </div>
      <div class="h-ficha-info">
        <p class="h-eyebrow rv">A Coleção Verité</p>
        <h1 class="h-h2 rv d1" id="ficha-titulo">%(h1)s</h1>
        <p class="h-ficha-meta rv d1">%(volume_esc)s</p>
        <p class="h-ficha-frase rv d2">%(frase_esc)s</p>
        <p class="h-selo rv d2" data-selo><span class="h-selo-ponto" aria-hidden="true"></span>Em breve</p>

        <div class="h-avise rv d3" data-form-container data-avise>
          <p class="h-avise-titulo">Avise-me quando chegar</p>
          <form class="stack-form" data-submit-endpoint="/api/public/waitlist" novalidate>
            <div class="field">
              <label for="avise-nome">Nome</label>
              <input id="avise-nome" name="name" type="text" autocomplete="name" placeholder="Seu nome" required/>
              <span class="field-error" aria-live="polite"></span>
            </div>
            <div class="field">
              <label for="avise-email">E-mail</label>
              <input id="avise-email" name="email" type="email" autocomplete="email" placeholder="Seu melhor e-mail" required/>
              <span class="field-error" aria-live="polite"></span>
            </div>
            <input type="hidden" name="perfume" value="%(nome_esc)s"/>
            <input class="hp-field" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"/>
            <button type="submit" class="btn btn-block">
              <span class="btn-label">Avise-me quando chegar</span>
              <span class="spinner" aria-hidden="true"></span>
            </button>
            <p class="form-error-general" role="alert" aria-live="polite" hidden></p>
          </form>
          <p class="note">Sem spam. Só um aviso, quando o %(nome_esc)s chegar.</p>
          <div class="form-thanks" role="status">
            <p class="form-thanks-title">Combinado.</p>
            <p class="form-thanks-sub">Você será avisado assim que o %(nome_esc)s chegar.</p>
          </div>
        </div>

        <!-- perfume-ficha.js revela isto quando o produto existir no painel -->
        <div class="h-disponivel" data-disponivel hidden>
          <p class="h-avise-titulo">Já disponível</p>
          <a class="h-btn" href="produtos.html" data-disponivel-link>Ver o perfume <span aria-hidden="true">&rarr;</span></a>
        </div>
      </div>
    </div>
  </section>

  <section class="h-outros" aria-labelledby="outros-titulo">
    <div class="h-outros-in">
      <p class="h-eyebrow rv">Conheça também</p>
      <h2 class="h-h2 rv d1" id="outros-titulo">Os outros <em>três.</em></h2>
      <div class="h-embreve-grid rv d2">
%(cards)s
      </div>
    </div>
  </section>

</main>''' % dict(
        nome=p['nome'], nome_esc=esc(p['nome']), slug=p['slug'], img=p['img'], w=p['w'], h=p['h'],
        volume_esc=esc(p['volume']), frase_esc=esc(p['frase']), h1=p['h1'],
        largo=' wide' if p.get('largo') else '', cards=cards)


def head_da_ficha(base, p):
    url = '%s/%s' % (BASE, p['ficha'])
    titulo = '%s — %s | Em breve — Verité Perfumes' % (p['nome'], p['volume'].replace(' · ', ', '))
    desc = ('%s, %s. %s Em breve na Verité — deixe seu e-mail e seja avisado quando chegar.'
            % (p['nome'], p['volume'].replace(' · ', ', '), p['frase']))
    desc_curta = '%s (%s). Em breve na Verité.' % (p['nome'], p['volume'].replace(' · ', ', '))

    t = base
    t = re.sub(r'<meta name="description" content="[^"]*"/>', '<meta name="description" content="%s"/>' % esc(desc), t, count=1)
    t = re.sub(r'<title>.*?</title>', '<title>%s</title>' % esc(titulo), t, count=1, flags=re.S)
    t = re.sub(r'<link rel="canonical" href="[^"]*"/>', '<link rel="canonical" href="%s"/>' % url, t, count=1)
    t = re.sub(r'<meta property="og:url" content="[^"]*"/>', '<meta property="og:url" content="%s"/>' % url, t, count=1)
    t = re.sub(r'<meta property="og:title" content="[^"]*"/>', '<meta property="og:title" content="%s"/>' % esc(titulo), t, count=1)
    t = re.sub(r'<meta property="og:description" content="[^"]*"/>', '<meta property="og:description" content="%s"/>' % esc(desc_curta), t, count=1)
    t = re.sub(r'<meta name="twitter:title" content="[^"]*"/>', '<meta name="twitter:title" content="%s"/>' % esc(titulo), t, count=1)
    t = re.sub(r'<meta name="twitter:description" content="[^"]*"/>', '<meta name="twitter:description" content="%s"/>' % esc(desc_curta), t, count=1)

    ld = {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': BASE + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'Perfumes', 'item': BASE + '/produtos.html'},
            {'@type': 'ListItem', 'position': 3, 'name': p['nome'], 'item': url},
        ],
    }
    t = re.sub(r'<script type="application/ld\+json">.*?</script>',
               lambda m: '<script type="application/ld+json">\n%s\n</script>' % json.dumps(ld, ensure_ascii=False, indent=2),
               t, count=1, flags=re.S)
    # tema claro/escuro e so do catalogo
    t = re.sub(r"<script>try\{if\(localStorage\.getItem\('verite-catalog-theme'\).*?</script>\r?\n", '', t, count=1, flags=re.S)
    # mesma linguagem visual da home
    t = t.replace('<link rel="stylesheet" href="assets/css/style.css"/>',
                  '<link rel="stylesheet" href="assets/css/style.css"/>\n<link rel="stylesheet" href="assets/css/home-nova.css"/>', 1)
    return t


def gerar():
    base = ler('produtos.html').replace('\r\n', '\n')
    conferir_dados_js()
    for p in PERFUMES:
        t = head_da_ficha(base, p)
        t = t.replace('<body>', '<body class="h-page">', 1)
        i, j = t.index('<main>'), t.index('</main>') + len('</main>')
        t = t[:i] + main_da_ficha(p) + t[j:]
        t = t.replace('href="#listing"', 'href="#topo"').replace('href="#top"', 'href="#topo"')
        # scripts: sai o que e so do catalogo, entra o das fichas
        t = t.replace('<script src="assets/js/listing.js"></script>\n', '')
        t = t.replace('<script src="assets/js/catalog-theme.js"></script>\n', '')
        t = t.replace('<script src="assets/js/generos-vazios.js" defer></script>',
                      '<script src="assets/js/perfumes-dados.js"></script>\n'
                      '<script src="assets/js/paginas-internas.js" defer></script>\n'
                      '<script src="assets/js/perfume-ficha.js" defer></script>\n'
                      '<script src="assets/js/generos-vazios.js" defer></script>')
        with io.open(os.path.join(RAIZ, p['ficha']), 'w', encoding='utf-8', newline='') as fh:
            fh.write(t)
        print('  gerado', p['ficha'])


def cartoes_html():
    """Bloco de 4 cartoes, para colar na vitrine de produtos.html (--cartoes)."""
    return '\n'.join(cartao(p) for p in PERFUMES)


if __name__ == '__main__':
    if '--cartoes' in sys.argv:
        print(cartoes_html())
    else:
        gerar()
