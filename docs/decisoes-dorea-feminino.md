# Doréa: de unissex para feminino

Mudança feita em 26/09/2026. Verité Doréa (Eau de Parfum, 30 ml) deixa de ser
unissex e passa a ser **feminino** em todo o site.

---

## 1. O que a busca encontrou

Procurei no projeto inteiro por `Doréa`, `Dorea`, `dorea`, `unissex`, `unisex`,
`genero=unissex` e `frasco-unisex`. O resultado separa em dois grupos bem
diferentes:

### a) O produto Doréa — pouquíssimos lugares

| Onde | O que era |
|---|---|
| `index.html` — sala 03 de `#colecao` | nome, volume, frase, imagem e o botão "Conhecer" apontando para `?genero=unissex` |
| `index.html` — prateleira do acesso antecipado | a foto, decorativa (`aria-hidden`) |
| `assets/js/home-nova.js` — `SHELF` | a mesma foto na fileira que acende |
| `assets/img/frasco-unisex.{webp,avif,png}` | a foto do frasco |
| `referencia/nova-home/` | cópia da foto na referência (fora do deploy) |
| `assets/js/hero-banner.js`, `index-lab.html` | banner e rascunho antigos — **fora do deploy** (`.vercelignore`) |

### b) A categoria "Unissex" — muitos lugares, e **não é o Doréa**

Mega menu, rodapé e filtros de 12 páginas, `products.js` (`GENDERS`),
`listing.js` (rótulos), `api/_handlers/*/products.js` (`genderMap`),
`api/_private/dashboard.html` (a opção no painel). Isso tudo é a **categoria**,
não o produto. Não apaguei nada disso — ver a decisão 3.

### c) O que a busca mostrou e mudou a estratégia

**O Doréa não existe no banco de dados.** `db/schema.sql` não tem nenhum
`INSERT INTO products`, e `/api/public/products` responde `{"products":[]}` em
produção. O Doréa vive **só como HTML estático** na sala 03 da home. Ou seja:
não há migração a fazer (item 4 do pedido) — não existe registro para migrar.

---

## 2. O que mudou

| Arquivo | Mudança |
|---|---|
| `index.html` | sala 03: `Conhecer` agora vai para `produtos.html?genero=feminino` |
| `index.html` (3×), `assets/js/home-nova.js`, `assets/js/hero-banner.js`, `index-lab.html`, `referencia/nova-home/index.html`, `docs/decisoes-nova-home.md` | 13 referências de `frasco-unisex` → `frasco-dorea` |
| `assets/img/frasco-unisex.{webp,avif,png}` | renomeados para `frasco-dorea.*` (com `git mv`, preservando o histórico) |
| `referencia/nova-home/assets/frasco-unisex.webp` | renomeado igual |
| `assets/js/generos-vazios.js` | **novo** — esconde gêneros sem produto (ver decisão 3) |
| 12 páginas HTML | passam a carregar `generos-vazios.js` |

**Nome, volume (30 ml), a frase "Única, como você.", a ordem das salas, as
cores e as partículas da sala 03: tudo intocado**, como pedido.

Os textos alternativos não precisaram de ajuste: o `alt` da sala 03 já era
"Frasco Verité Doréa, Eau de Parfum 30 ml" e o `aria-label` do `<article>` já
era "Verité Doréa" — nenhum dos dois dizia "unissex".

---

## 3. Decisões que tomei sozinho

### 3.1 Esconder "Unissex" — mas só quando já existir catálogo

O pedido: se a categoria ficar sem produto, some do menu, do filtro e do
rodapé, sem apagar a lógica.

O problema: **o catálogo inteiro está vazio hoje.** Se a regra fosse apenas
"gênero sem produto some", sumiriam Feminino, Masculino e Unissex — o menu
ficaria mutilado e o site pareceria quebrado.

A regra que implementei em `assets/js/generos-vazios.js`:

> Esconde um gênero quando o catálogo **tem** produtos e **nenhum** deles é
> daquele gênero. Com o catálogo vazio, não esconde nada.

Assim: hoje o menu continua igual; no dia em que o Doréa for cadastrado como
feminino, a categoria Unissex some sozinha; e se um dia entrar um produto
unissex, ela volta sozinha. Nada é apagado — os links, as colunas do mega menu
e `VeriteProducts.GENDERS` continuam no lugar, só ganham `hidden`.

### 3.2 Não redirecionei `?genero=unissex`

O pedido permitia redirecionar para `?genero=feminino`. Não fiz, por dois
motivos: essa URL é da **categoria**, não do Doréa — redirecionar quebraria o
dia em que existir um produto unissex de verdade; e ela **já não dá erro**,
abre o catálogo normalmente com o estado vazio. O único link que apontava o
Doréa para lá era o "Conhecer" da sala 03, e esse foi corrigido na origem.

### 3.3 SEO: nada a mudar

Procurei o Doréa em `title`, `description`, JSON-LD e `sitemap.xml`: **ele não
aparece em nenhum**. As menções a "Unissex" no título e na descrição de
`produtos.html` descrevem o escopo do catálogo, não o Doréa — e a categoria
continua existindo (só fica escondida enquanto estiver vazia). Mexer ali seria
mudar o que não foi pedido.

### 3.4 Painel: a opção "Unissex" fica

`api/_private/dashboard.html` continua oferecendo Unissex no cadastro de
produto, e o `genderMap` das APIs também. É a lógica que o pedido mandou
preservar. Quando o Doréa for cadastrado, basta escolher **Feminino**.

---

## 4. O que NÃO foi tocado

- Banner (`hero-gigante.js`) e o visual da nova home, além do link da sala 03.
- Preço, estoque, fotos, notas olfativas e descrição: nada inventado, nada
  alterado. Só a classificação mudou.
- A lógica da categoria Unissex em nenhuma camada.

---

## 5. Quando o Doréa for cadastrado no painel

Escolha **Feminino** no campo de gênero. A partir daí, sozinho e sem código:

1. ele aparece em `produtos.html?genero=feminino` e no filtro Feminino;
2. entra na coluna "Femininos" do mega menu;
3. a categoria Unissex some do menu, do filtro e do rodapé (decisão 3.1).
