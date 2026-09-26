# Nova home (depois do banner)

Troca feita em 26/09/2026. Fonte oficial do visual: `referencia/nova-home/index.html`
(prévia pública, projeto Vercel separado: https://verite-nova-home.vercel.app).

## O que mudou em index.html
- Saíram: `#colecao` antiga (4 cards), `#fragrancias` (portas de categoria com filtro),
  `#vitrine-reel`, a faixa `.statement` e `#essencia-mini`.
- Entraram, nesta ordem, depois do banner:
  1. `#colecao` — coleção em salas (palco fixo, trilho horizontal, partículas por sala).
  2. `.h-values` — letreiro de valores.
  3. `#manifesto` — manifesto com as palavras acendendo (leva para sobre.html).
  4. Vitrines dinâmicas `#destaques`, `#favoritos-verite`, `#lancamentos-verite`,
     `#presentes` — mantidas iguais, continuam ocultas até existir produto.
  5. `#quiz` — mesmo motor (`quiz.js`, recomenda produto real); só o visual mudou.
  6. `#clube-home` — cartão 3D + 4 benefícios, botão para /clube.
  7. `#lancamento` — mesmo formulário real (`main.js` → `/api/public/waitlist`);
     quando o envio dá certo os frascos da fileira acendem.
- `assets/js/fragrancias.js` saiu da home (a seção dele não existe mais; o arquivo ficou).
- skip-link aponta para `#colecao`.

## Arquivos novos
- `assets/css/home-nova.css` — classes com prefixo `h-`, fichas de cor próprias
  (as seções não usam `.section-dark`). Palcos fixos grudam em `--header-h-compact`.
- `assets/js/home-nova.js` — salas, letreiro, manifesto, veste os botões do quiz,
  cartão do Clube e fileira do acesso antecipado. Um único requestAnimationFrame,
  desliga em prefers-reduced-motion.

## Ajuste no banner
- `assets/js/hero-gigante.js`: no Estúdio (última cena) os capítulos I–V somem.
  No celular eles ficavam por cima do link "Clube Verité".

## Dados
- Mapeamento dos frascos: Feminino 50 ml = frasco-feminino.webp; Masculino 40 ml =
  frasco-verite-hero.webp; Doréa 30 ml = frasco-dorea.webp; Kit 30·50·20 ml = frasco-kits.webp.
- Nenhuma nota olfativa ou preço inventado. As frases de cada sala vêm dos valores da marca.

## Testado
1440x900 e 390x844: sem erros no console, sem rolagem horizontal, formulário com
sucesso simulado, quiz até o resultado.

## Falta
Commit e push para publicar.
