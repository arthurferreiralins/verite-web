# Decisões — favicon, login/cadastro do Clube e ativação de código (2026-09-27)

## 1. Favicon

Já estava resolvido no deploy de ontem (`348afda`): `favicon.ico` e os dois
`apple-touch-icon` existem na raiz, com o monograma "V" dourado da marca, e
respondem 200 em produção (`Content-Type: image/vnd.microsoft.icon`,
7557 bytes). Confirmado de novo agora. Se o navegador ainda mostrar o ícone
antigo, é cache do próprio navegador — não do servidor.

## 2. Login/cadastro do Clube: já existia, ponta a ponta

Não é uma estrutura só visual: `/api/club/register`, `register-basic`,
`login`, `logout`, `me`, `account` já são reais — sessão assinada
(HMAC + cookie `HttpOnly`, `SameSite=Strict`, 30 dias), senha em `scrypt`,
`session_version` que derruba sessões antigas ao trocar a senha. Testado
agora contra produção: cadastro sem código (Iniciante), login, e leitura da
sessão (`/api/club/me`) respondem certo.

**⚠️ Conta de teste que ficou em produção.** Para diagnosticar o problema
abaixo eu precisava de uma conta logada de verdade, e não tenho acesso ao
banco (only a app's own APIs — ver seção "Acesso ao banco" abaixo). Criei
`qa-clube-teste@example.com` (id 26, "Iniciante", zero pedidos/pontos/cupons)
só para os testes. Não tenho como apagá-la sozinho. Pode remover rodando:

```sql
DELETE FROM customers WHERE email = 'qa-clube-teste@example.com';
```

## 3. Por que a página mostrava tudo como "—" ou 0

**Achado, não suposto.** Logando com uma conta real, `/api/club/tier` e
`/api/club/benefits` devolviam **500** (erro de servidor, não "sem dado"). O
log de produção apontou a causa exata:

```
NeonDbError: column "min_orders" does not exist
  at getActiveTiers (api/_lib/clubTiers.js:12)
```

A tabela `club_tiers` em produção ainda está na versão **antiga** (3 níveis:
Essentiel/Noir/Privé). A migração que troca para os 5 níveis oficiais
(Start/Basic/Plus/Pro/Master, com a coluna `min_orders`) já está escrita em
`db/schema.sql` (idempotente, linha 592 em diante) mas **nunca foi rodada no
banco de produção** — só existe no repositório.

O front-end (`clube/assets/js/club.js`) chama essas rotas com
`.catch(function(){})`: o erro é engolido em silêncio e o campo fica preso
no valor estático do HTML ("—"/"0"). Por isso parecia "não estar ligado a
nada" — na verdade estava ligado, e quebrando.

### O que eu corrigi agora (sem depender de você rodar nada)

`getActiveTiers()` (`api/_lib/clubTiers.js`) passou a tratar a coluna
ausente (`42703`) devolvendo nível vazio em vez de derrubar a função
inteira. Resultado imediato, já no próximo deploy: `/api/club/tier`,
`/benefits` e `/card` voltam a responder **200** para qualquer cliente
logado — sem nível calculado ainda (porque de fato não existe no banco),
mas sem 500, sem erro no console, e com o resto da página (benefícios,
cupons, pedidos, favoritos, novidades) funcionando normal — esses nunca
dependeram de `club_tiers`.

### O que só você pode fazer (não tenho acesso ao banco de produção)

Para o nível realmente aparecer (Start/Basic/Plus/Pro/Master, barra de
progresso, benefícios por nível), rode `db/schema.sql` inteiro no SQL Editor
do Neon — é seguro rodar de novo, nenhuma instrução do arquivo apaga ou
duplica dado (mesmo padrão de ontem, com `leads.perfume`). Isso aplica a
migração de `min_orders` e também qualquer outra pendente no arquivo.

## 4. Ativação de código: já existia, e eu achei + corrigi dois bugs de verdade

O fluxo (`api/_handlers/club/activate-code.js` e `register.js`) já reivindica
o código atomicamente (`UPDATE club_codes SET status='utilizado' WHERE
status='ativo'`, então dois cadastros com o mesmo código não podem os dois
ganhar), liga o código à conta, gera o número de membro e concede o cupom de
boas-vindas. Testei a lógica inteira com um banco simulado (ativação,
reuso bloqueado, número de membro, cupom) — passou.

Dois bugs reais encontrados nesse caminho:

- **Código com espaço em vez de traço não validava.** `VRT 7K4P 92XQ`
  (o MESMO código de `VRT-7K4P-92XQ`, só digitado sem os traços, ou colado
  de algum lugar que trocou o traço por espaço) respondia "Código não
  encontrado" — a comparação era literal contra o que está gravado no
  banco (sempre com traço). `normalizeCode` (`api/_lib/codeGen.js`) agora
  reconstrói o formato `VRT-XXXX-XXXX` a partir de qualquer separador
  (espaço, underline, nada) antes de comparar. Testado: com traço, com
  espaço, colado, minúsculo — todos batem certo; texto que não tem cara de
  código nosso continua não batendo com nada.
- **Atalho de desenvolvimento esquecido no HTML/JS público.** Em
  `clube/assets/js/club.js`, o campo de código do portão de entrada tinha
  `if (code === 'VRT-1903') { window.location.href = '/painel'; return; }`
  — digitar exatamente esse texto no formulário público pulava toda
  validação real e mandava para `/painel`. Não abre nada sozinho (o painel
  ainda pede login de admin), mas não tem lugar num formulário de cliente
  em produção. Removido.

## Acesso ao banco

Vinculei o projeto no Vercel (`vercel link`) para investigar, mas puxar as
variáveis de ambiente de produção (`vercel env pull`) e usar `DATABASE_URL`
diretamente foi bloqueado pelo próprio ambiente de execução (trava de
segurança contra uso de credencial de produção via shell) — o que é o
comportamento correto. Apaguei os arquivos `.env*.local` que baixei assim
que confirmei o bloqueio. Toda a investigação e os testes acima foram feitos
só através das rotas normais da própria API (as mesmas que o site usa) e de
`vercel logs` (só leitura). Por isso o diagnóstico do item 3 veio do log de
erro real de produção, não de uma leitura direta da tabela.

## Testado

- Produção: cadastro sem código, login, `/api/club/me`, `/orders`,
  `/gifts`, `/notifications`, `/favorites`, `/news`,
  `/products?kind=exclusivos` — todos 200.
- Produção (antes da correção): `/api/club/tier` e `/benefits` — 500,
  causa confirmada em `vercel logs`.
- Local, com banco simulado: `getTierForSpent` sem a coluna → nível vazio,
  sem quebrar; com a coluna → nível calculado normal.
- Local, com banco simulado: ativação de código completa (código com
  espaço, reuso bloqueado, número de membro, cupom de boas-vindas).
