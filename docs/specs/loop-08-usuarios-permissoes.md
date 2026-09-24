# Loop 08 — Usuários, permissões e auditoria

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 08 · **Tamanho:** L · **Depende de:** Loop 0
**Arquivos tocados:** `auth.js`, `db.js` (User, Session, AuditLog), `server.js`, `public/login.html`, `public/app.js`

## Objetivo
Só quem tem login entra. A dona vê as duas escolas; a diretora de cada escola vê só a própria. Salários, CPF e rescisões ficam escondidos de quem não deve ver, e toda alteração sensível fica registrada com quem, quando e o quê. **É o portão para o app sair deste computador e ir para a nuvem.**

## Escopo
**Dentro:**
- Login com senha (hash `scrypt` do `node:crypto`), sessão em cookie httpOnly + SameSite=Strict (+ `Secure` quando servido por HTTPS)
- Papéis: `owner` (dona, vê as duas escolas), `director` (por escola)
- Toda rota filtra pelas escolas permitidas do usuário
- Salário/CPF/rescisão mascarados para papéis sem permissão
- Log de auditoria em funcionários, rescisões, lançamentos e permissões
- Limite de tentativas de login e bloqueio temporário
- Primeiro usuário (dona) criado por variável de ambiente

**Fora (explicitamente):**
- Papel de contabilidade (leitura) — **cortado deste loop**: o dono confirmou que por agora só ele e as diretoras terão login; o desenho de papéis já deixa espaço para adicionar `accountant` depois sem redesenhar nada (carry-over)
- Máscara de salário/CPF para papéis sem permissão — **cortado deste loop**: as únicas duas pessoas com login (dona e diretora) precisam ver e editar salário/CPF da(s) própria(s) escola(s) para o app cumprir sua função (folha, rescisão); não existe hoje um papel "vê mas não pode ver dado sensível". Volta ao escopo assim que o papel `accountant` (leitura) for adicionado — é a mesma decisão do item anterior
- Login social/SSO
- Recuperação de senha por e-mail (troca feita pela dona)
- Autenticação em dois fatores (carry-over)
- Infraestrutura de deploy em si (Droplet, Vercel, proxy/TLS, variáveis de produção) — este loop deixa o app *pronto* para rodar atrás de HTTPS (cookie `Secure` condicional, sessão revogável, sem segredo no código), mas o deploy de fato é um passo separado, fora do Loop Engineering do app

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Onde vai rodar | Nuvem (Droplet + Vercel, infra a definir depois) | Resposta do dono via `AskUserQuestion` em 2026-09-24 | Confirmada (REFINEMENT) |
| Quem vai usar | Dona (`owner`, as 2 escolas) + 1 diretora por escola (`director`) | Resposta do dono; contabilidade fica de fora por ora | Confirmada (REFINEMENT), corte de escopo |
| Hash de senha | `scrypt` nativo (`node:crypto`) | Sem dependência nativa para compilar | Confirmada (REFINEMENT) |
| Sessão | Token opaco (`randomBytes`) armazenado no Mongo com expiração, cookie httpOnly + SameSite=Strict | Revogável (basta apagar o documento), sem JWT para decodificar/vazar | Confirmada (REFINEMENT) |
| Cookie `Secure` | Condicional a uma variável de ambiente (`COOKIE_SECURE=1`), não ligado sempre | Em `127.0.0.1` sem TLS (uso local/dev) um cookie `Secure` nunca seria enviado, quebrando o login; liga-se ao ir para produção atrás de HTTPS | Proposta |
| `LISTEN_HOST` continua `127.0.0.1` por padrão | Sim, mesmo indo para a nuvem | Na nuvem, um proxy (nginx/Caddy) termina o TLS e fala com o app em loopback — é o padrão de mercado e mantém a regra "nada exposto direto" até que o proxy seja configurado, o que é passo de infra, não deste loop | Proposta |

## Critérios de aceite
- [x] AC1 — Qualquer `/api/*` sem sessão válida devolve 401 (exceto `/api/auth/login`) *(verificar: teste `AC1` + navegador)*
- [x] AC2 — Diretora do CIC não lê nem escreve dados do Novo Mundo (e vice-versa): 403 em todos os recursos; "todas as escolas" para uma diretora nunca inclui a outra escola; a dona lê e escreve nas duas *(verificar: sonda de acesso por recurso, teste `AC2`)*
- [x] AC3 — Alterar salário ou aplicar rescisão grava auditoria com usuário autor, data, e (quando fizer sentido) valor antigo e novo, consultável em `/api/audit` *(verificar: teste `AC3`)*
- [x] AC4 — 6 senhas erradas seguidas para o mesmo usuário bloqueiam o login por 15 minutos; a 7ª tentativa (mesmo com a senha certa) ainda é bloqueada *(verificar: teste `AC4`)*
- [x] AC5 — Senha nunca aparece em log, resposta da API (nem na criação, nem no login, nem na listagem) ou documento do Mongo em texto puro (só o hash) *(verificar: teste `AC5` + inspeção do documento)*
- [x] AC6 — Só a dona cria/edita usuários e vê a auditoria; uma diretora recebe 403 em `/api/users` e `/api/audit` *(verificar: teste `AC6`)*
- [x] AC7 — Fazer logout invalida a sessão imediatamente: a mesma sessão usada depois do logout devolve 401 *(verificar: teste `AC7`)*

## Notas de design
- `auth.js`: `hashPassword`, `verifyPassword` (scrypt + salt), `createSessionToken` — funções puras/testáveis por fora do HTTP.
- Escopo por escola aplicado em um único ponto dentro de `api()` (antes do `RESOURCES` genérico e de `buildReport`/`report`/`statement`/`metrics`/etc.) para não esquecer nenhuma rota — mesma ideia do `@TenantId()` do Kivoni: uma função `allowedSchool(user, schoolIdOrParam)` que lança 403 se a escola não é permitida, chamada em todo ponto que hoje recebe `school_id`/`school`.
- Papel modelado como um campo livre (`role: 'owner' | 'director'`) mais `school_ids: [ObjectId]` (vazio/ignorado para `owner`, que sempre pode tudo), para que adicionar `accountant` (e a máscara de campos sensíveis, cortada deste loop) depois seja só um novo valor de `role` e uma regra a mais, sem migração de schema.
- Sessão: cookie `sid` com um token opaco (`randomBytes(32).toString('hex')`); documento `Session { token (único), user_id, expires_at }` no Mongo. `requireAuth` lê o cookie, busca a sessão não expirada, carrega o usuário e anexa a `req.user`. Cookie: `httpOnly; SameSite=Strict; Path=/` sempre, mais `Secure` quando `COOKIE_SECURE=1`.
- Bloqueio de tentativas: `failed_attempts` e `locked_until` no próprio documento `User`; zera `failed_attempts` em login OK.
- Nenhuma dependência nova: parsing do cookie feito à mão (`req.headers.cookie`), sem `cookie-parser`.

## Configuração
`SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SESSION_TTL_HOURS`, `COOKIE_SECURE` (0/1, default 0) em `.env.example`.

## Tarefas
- [x] 1. `auth.js` (hash, token de sessão) com testes puros
- [x] 2. `User`, `Session` e `AuditLog` no `db.js`
- [x] 3. Rotas `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`; middleware de sessão em `api()`
- [x] 4. Escopo por escola em todo ponto que recebe `school_id`/`school` (CRUD genérico, relatório, DRE, métricas, alertas, cenários, exportação, conciliação, contas/mensalidades, calendário, rescisão)
- [x] 5. CRUD de usuários (só a dona: criar/editar diretora, nunca ver a senha de volta)
- [x] 6. Log de auditoria nas rotas sensíveis (funcionários, rescisão, usuários), consultável em `/api/audit`
- [x] 7. Tela de login (`public/login.html`) e redirecionamento sem sessão
- [x] 8. Sonda de acesso completa (401/403 por recurso e por papel) e VERIFY

## Registro de acompanhamento
### PLAN        — [x] explorou o código · [x] spec rascunhada · [x] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (onde roda e quem usa, confirmadas com o dono em 2026-09-24) · [x] suposições conferidas (nenhum cookie/sessão/hash existente em `server.js`; `node:http` bruto, sem framework — middleware de auth vai ser função simples chamada no topo de `api()`) · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-24
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (`.env.example`) → feito em 2026-09-24
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · suítes: lógica 14/14 · API 60/60 → verde em 2026-09-24
### VERIFY      — [x] passeio no navegador + capturas · [x] checklist de ACs · [x] sonda hostil (senha errada 2x, sessão apagada, mobile 375px) · [x] regressão (suíte completa) · [x] números conferidos à mão (lucro da diretora do CIC = linha "CIC" do relatório da dona) → tudo ✅ em 2026-09-24
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-24
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado · [x] memória atualizada → próximo loop iniciado em 2026-09-24

## Registro de verificação
| AC | Evidência |
|---|---|
| AC1 | `test/api/auth.test.js` "AC1"; no navegador, `/` sem sessão redirecionou para `/login.html` (confirmado depois de apagar as sessões no Mongo) |
| AC2 | `test/api/auth.test.js` "AC2"; no navegador, logada como `diretora.cic@demo.local`, o seletor de escola só listava CIC, o Painel mostrou só os números do CIC (lucro R$ 41.901, igual à linha "CIC" do relatório consolidado da dona), e a aba "Usuários" não apareceu |
| AC3 | `test/api/auth.test.js` "AC3" (troca de salário e rescisão, com before/after) |
| AC4 | `test/api/auth.test.js` "AC4"; `test-auth.js` no nível puro (`recordFailedAttempt`/`isLocked`) |
| AC5 | `test/api/auth.test.js` "AC5"; `test-auth.js`; inspeção manual do documento `User` no Mongo (só `password_hash`, nunca a senha) |
| AC6 | `test/api/auth.test.js` "AC6" |
| AC7 | `test/api/auth.test.js` "AC7"; no navegador, clicar "Sair" redirecionou para o login e a mesma aba não conseguiu mais ver o Painel |

## Resultado
Entregou login com sessão em cookie (httpOnly + SameSite=Strict, `Secure` condicional a `COOKIE_SECURE`), dois papéis (`owner` vê as duas escolas, `director` só a(s) sua(s)), escopo por escola aplicado em todo ponto do `api()` que recebe uma escola (CRUD genérico, relatório, DRE, métricas, alertas, cenários, exportação, conciliação bancária, contas/mensalidades, calendário e rescisão — inclusive o caso "todas as escolas", que para uma diretora nunca inclui a outra), CRUD de usuários restrito à dona, log de auditoria em alteração de salário/rescisão/usuário consultável em `/api/audit`, bloqueio de 15 minutos após 6 tentativas erradas, e a tela de login com redirecionamento automático. Nenhuma dependência nova (cookie, hash e sessão feitos só com `node:crypto`/`node:http`).

Desvio do plano original: a máscara de campos sensíveis (salário/CPF) foi cortada do escopo na própria REFINEMENT, antes do IMPLEMENT — as únicas duas pessoas com login hoje (dona e diretora) precisam ver esses campos para o app cumprir sua função; volta ao escopo junto com o papel `accountant`. Duas ACs (AC6, AC7) foram acrescentadas durante o IMPLEMENT além das 5 planejadas, cobrindo a restrição de `/api/users`/`/api/audit` à dona e a invalidação de sessão no logout — nenhuma delas estava nas decisões da REFINEMENT, mas ambas são consequência direta do desenho e valiam o teste.

Retro:
1. Fazer o escopo por escola em um helper central (`checkAllowed`) chamado em cada rota, em vez de confiar em cada handler individualmente, foi o que tornou a sonda de acesso (AC2) viável de escrever com confiança — sem isso, seria fácil esquecer uma rota.
2. Atualizar `test/api/helpers.js` para logar como a dona automaticamente manteve as 53 suítes de testes anteriores passando sem editar nenhuma delas — o `start()` centralizado pagou o investimento feito nos loops anteriores.
3. Mutation testing no gate de 401 e no `checkAllowed` (neutralizando cada um e confirmando que os testes de auth realmente quebram) valeu a pena logo de cara: são os dois pontos onde um bug significaria vazar dados entre escolas.

Carry-overs:
- Papel `accountant` (leitura, sem dados sensíveis) e a máscara de salário/CPF que viria com ele.
- Recuperação de senha por e-mail (hoje só a dona troca a senha de qualquer um).
- Autenticação em dois fatores.
- Infraestrutura de deploy real (Droplet + Vercel): este loop deixou o app pronto para HTTPS (`COOKIE_SECURE`), mas a escolha de qual serviço serve o quê (app Node em Droplet, front estático ou proxy em Vercel?), TLS, variáveis de produção e o `SEED_OWNER_PASSWORD` real ainda são passos manuais fora do Loop Engineering do app.
- Confirmar a decisão "todas as escolas para uma diretora multi-escola" (hoje cada diretora tem uma escola só; o código já soma corretamente para `school_ids` com mais de uma escola, mas não foi testado com um caso real de duas).
