# Decisões — ajustes pós-home (2026-09-26)

Pacote de 8 correções aplicado depois da nova home. Nada do banner nem da
home mudou visualmente, exceto os pisos de legibilidade do item 8.

## ⚠️ O que o dono precisa fazer (eu não tenho acesso ao painel nem ao banco de produção)

### 1. Rodar UMA linha no Neon (SQL Editor)

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS perfume TEXT;
```

Sem isso o site **continua funcionando**: o `POST /api/public/waitlist` detecta
a ausência da coluna (erro `42703`), grava só nome + e-mail e devolve sucesso.
O que se perde até a migração: saber **de qual perfume** a pessoa pediu aviso.
Depois de rodar, o campo passa a ser gravado sozinho e o CSV do painel
(`/api/admin/leads`) ganha a coluna "perfume".

### 2. Campos do painel que estão vazios e precisam ser preenchidos

| Campo (painel → Configurações) | Onde aparece | Enquanto estiver vazio |
|---|---|---|
| **Instagram (URL)** | rodapé de todas as páginas | o item **some** (não mostra mais `@verite.perfumes` fixo) |
| **E-mail de contato** | rodapé e página Sobre | o item **some** |
| **Logo** | cabeçalho/rodapé (`data-logo`) | usa o arquivo estático da marca |
| **Favicon** | aba do navegador | usa `favicon.ico` / `favicon-32.png` estáticos |
| WhatsApp | botão flutuante, rodapé, Sobre | já preenchido; segue o painel |

Fora do painel (arquivo `assets/js/dados-empresa.js`): razão social, CNPJ,
endereço e e-mail jurídico — ainda dependem do dono.

Quando o Instagram e o e-mail forem cadastrados, aparecem sozinhos, com o
valor do painel (texto **e** link), sem republicar nada.

## Item 1 — "Conhecer" não cai mais num catálogo vazio

- **4 fichas estáticas** geradas por `tools/gerar-fichas.py` a partir de
  `assets/js/perfumes-dados.js` (fonte única): `perfume-feminino.html`
  (50 ml), `perfume-masculino.html` (40 ml), `perfume-dorea.html` (30 ml),
  `perfume-kit.html` (30·50·20 ml). Cada uma com foto, nome, volume, frase do
  quarto da home, selo "Em breve", formulário "Avise-me quando chegar" e links
  para as outras 3. Estáticas de propósito: indexáveis (title, canonical,
  JSON-LD próprios) e funcionam sem JS. Entraram no `sitemap.xml`.
- **Formulário** usa o motor genérico do `main.js` (`data-submit-endpoint`) e
  posta em `/api/public/waitlist` com o campo `perfume`. Testado: o payload sai
  com o nome do perfume e a tela de agradecimento aparece.
- **Guiado por dados** (`perfume-ficha.js`, `generos-vazios.js`): enquanto o
  produto não existe em `/api/public/products`, o botão "Conhecer" da home vai
  para a ficha; assim que o produto é publicado (slug `dorea`, etc.) o botão
  passa para `produto.html?slug=…` e a ficha vira "Disponível" com link.
  Testado publicando um Doréa falso: tudo reverte sozinho.
- **produtos.html** com catálogo vazio mostra a vitrine dos 4 "em breve" no
  lugar de "Em preparação"; com produto publicado, a vitrine some e a grade
  aparece.
- Menu e rodapé: com catálogo vazio, "Comprar" vira "Coleção" e "Perfumes"
  lista os 4 "em breve" com link para as fichas.

## Item 2 — Sem "Unissex" e sem facetas vazias

- `title`/`description` de produtos.html sem "Unissex" (e `document.title`
  montado por `listing.js` também).
- Filtros de gênero/categoria, mega menu e rodapé mostram **só** as facetas com
  ≥1 produto publicado. A lógica não foi apagada: quando existir produto
  masculino/unissex/kit, a faceta volta sozinha.

## Item 3 — Cabeçalho compacto

- Desktop: 159 → **73 px** ao rolar; celular: 127 → **57 px**.
- A barra de busca vira **lupa** no modo compacto (clique abre a barra sobre o
  cabeçalho; Esc, clique fora ou voltar ao topo fecham); menu numa linha só.
- `--header-h` e `--header-h-compact` continuam publicados por `main.js`.
  A medida compacta é tirada com transições desligadas (`header.medindo`) —
  senão capturava o meio da animação.
- **Bug encontrado e corrigido nos testes:** como o cabeçalho é `sticky` e
  ocupa espaço no fluxo, encolher 86 px fazia o navegador (scroll anchoring)
  recuar o `scrollY`; caía abaixo de 40 px, o cabeçalho voltava a crescer e a
  rolagem **tremia entre ~40 e ~125 px**. Correção: `header.is-scrolled` ganha
  `margin-bottom = --header-h − --header-h-compact`, devolvendo ao fluxo o que
  o cabeçalho encolheu. Altura do documento constante → nada pula.
- Banner, salas e manifesto grudam exatamente em `--header-h-compact`
  (desvio medido **0 px** nas 25 amostras de cada palco, em 1440, 1280 e 390).

## Item 4 — Jost

`--font-sans` começa por `Jost` (com o resto da pilha atrás, como fallback).
Verificado nas 12 páginas × 4 larguras: sem rolagem horizontal, menu em uma
linha, nenhum texto estourando botão/rótulo.

## Item 5 — Rodapé guiado pelo painel

Instagram e e-mail nascem `hidden` no HTML de todas as páginas e só aparecem
quando `/api/public/settings` traz o valor. Corrigido junto: o texto do link
("Instagram — @perfil") ficava com o perfil antigo enquanto o `href` já era o
novo (`applyLinkSetting`).

## Item 6 — Doréa

Linha de meta do quarto: **"Eau de Parfum · 30 ml"**.

## Item 7 — Páginas internas com a linguagem da home

`produtos.html`, `produto.html` e `sobre.html`: fundo preto com luz dourada
radial, título em Cormorant com a palavra-chave em itálico dourado, eyebrow em
Jost espaçado, botões `.h-btn`, reveal suave. Reaproveitei as classes `h-`
(`.h-pagehero`, `.h-ph-title`, `.h-dark`, `body.h-page`). **Textos reais não
foram alterados.** Coroa, folhas e monograma "V" não são mais desenhados em
nenhuma seção dessas 3 páginas (`body.h-page{--bg-symbols:none}`); as demais
páginas (carrinho, favoritos, termos…) mantêm o visual atual.

## Item 8 — Legibilidade e os "3 × 404"

- Piso de **12 px** em qualquer texto visível (menu, legendas, rótulos,
  `.eyebrow`, `.btn`, itens do rodapé, etc.) — auditado em todas as páginas em
  1440 e 390; **0 ocorrências** abaixo de 12 px. No celular, notas e legendas de
  apoio (`.copyright`, `.note`, `.meta`, `.legal-updated`) sobem para **13 px**.
  Rótulos em caixa alta espaçada (eyebrows, kickers) ficam em 12 px de
  propósito: é o tamanho de rótulo, não de leitura corrida.
- **3 × 404:** eram requisições automáticas do navegador que não aparecem no
  HTML: `/favicon.ico`, `/apple-touch-icon.png` e
  `/apple-touch-icon-precomposed.png`. Os três arquivos agora existem na raiz.
  (Headless não reproduz esses pedidos — conferir em produção depois do deploy.)

## Infra

- `.vercelignore` ganhou `tools/` (gerador só do repositório).
- `db/schema.sql` ganhou o `ALTER TABLE` do campo `perfume` (o schema é
  aplicado manualmente).

## Como foi testado

Playwright servindo o projeto por interceptação de rotas, APIs simuladas:
fichas (conteúdo, foto, links, envio do formulário com o nome do perfume),
troca automática ao publicar produto, filtros/menu/rodapé, cabeçalho e palcos
fixos (3 larguras), auditoria de fontes, layout das 12 páginas em 4 larguras,
console sem erro, sem imagem quebrada, sem rolagem horizontal.
