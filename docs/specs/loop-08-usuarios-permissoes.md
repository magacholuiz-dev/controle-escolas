# Loop 08 — Usuários, permissões e auditoria

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 08 · **Tamanho:** L · **Depende de:** Loop 0
**Arquivos tocados:** `auth.js`, `db.js` (Usuario, Auditoria), `server.js`, `public/login.html`, `public/app.js`

## Objetivo
Só quem tem login entra. A dona vê tudo; a diretora de cada escola vê a própria escola; a contabilidade só lê e exporta. Salários, CPF e rescisões ficam escondidos de quem não deve ver, e toda alteração sensível fica registrada com quem, quando e o quê. **É o portão para qualquer uso fora do computador local.**

## Escopo
**Dentro:**
- Login com senha (hash `scrypt` do `node:crypto`), sessão em cookie httpOnly + SameSite=Strict
- Papéis: dona, diretora (por escola), contabilidade (leitura)
- Toda rota filtra pelas escolas permitidas do usuário
- Salário/CPF/rescisão mascarados para papéis sem permissão
- Log de auditoria em funcionários, rescisões, lançamentos e permissões
- Limite de tentativas de login e bloqueio temporário
- Primeiro usuário criado por variável de ambiente

**Fora (explicitamente):**
- Login social/SSO
- Recuperação de senha por e-mail (troca feita pela dona)
- Autenticação em dois fatores (carry-over)

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Onde vai rodar | ABERTA: só neste computador ou na nuvem? | Decide a urgência e o cuidado com HTTPS e backup | ABERTA |
| Quem vai usar | ABERTA: só você, as diretoras, o contador? | Define os papéis reais | ABERTA |
| Hash de senha | `scrypt` nativo | Sem dependência nativa para compilar | Proposta |
| Sessão | Token opaco no Mongo com expiração | Revogável, sem JWT para vazar | Proposta |

## Critérios de aceite
- [ ] AC1 — Qualquer `/api/*` sem sessão devolve 401; `/` redireciona para o login *(verificar: teste `AC1` + navegador)*
- [ ] AC2 — Diretora do CIC não lê nem escreve dados do Novo Mundo: 403 em todos os recursos *(verificar: sonda de acesso por recurso)*
- [ ] AC3 — Contabilidade lê o Painel e os relatórios e recebe 403 em qualquer POST/PUT/DELETE *(verificar: teste `AC3`)*
- [ ] AC4 — Papel sem permissão vê salário como "•••" e não recebe CPF no JSON *(verificar: teste no corpo da resposta, não só na tela)*
- [ ] AC5 — Alterar salário grava auditoria com usuário, data, valor antigo e novo *(verificar: teste `AC5`)*
- [ ] AC6 — 6 senhas erradas seguidas bloqueiam o login por 15 minutos *(verificar: teste `AC6`)*
- [ ] AC7 — Senha nunca aparece em log, resposta ou banco em texto puro *(verificar: teste + inspeção do documento)*

## Notas de design
- `auth.js`: `hashSenha`, `verificarSenha`, `criarSessao`, middleware `exigir(papel)`.
- Escopo por escola aplicado em um único ponto (o CRUD genérico e o relatório) para não esquecer nenhuma rota, como o `@TenantId()` do Kivoni.
- Máscara de campos sensíveis no serializador, não no front.

## Configuração
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SESSION_TTL_HORAS` em `.env.example`.

## Tarefas
- [ ] 1. Resolver onde roda e quem usa (REFINEMENT)
- [ ] 2. `auth.js` com testes
- [ ] 3. Usuário, Sessão e Auditoria
- [ ] 4. Escopo por escola no CRUD genérico e no relatório
- [ ] 5. Máscara de campos sensíveis
- [ ] 6. Tela de login e gestão de usuários
- [ ] 7. Sonda de acesso completa (401/403) e VERIFY

## Registro de acompanhamento
### PLAN        — [ ] explorou o código · [ ] spec rascunhada · [ ] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [ ] decisões resolvidas · [ ] suposições conferidas · [ ] ACs testáveis · [ ] revisão de DoR → Ready em ____
### IMPLEMENT   — [ ] tarefas feitas · [ ] `node --check` + `npm test` verdes por tarefa · [ ] env documentado → feito em ____
### TEST        — [ ] testes nomeados por AC · [ ] caminhos negativos · suítes: lógica _/_ · API _/_ → verde em ____
### VERIFY      — [ ] passeio no navegador + capturas · [ ] checklist de ACs · [ ] sonda hostil · [ ] regressão · [ ] números conferidos à mão → tudo ✅ em ____
### DOCUMENT    — [ ] Resultado da spec · [ ] changelog do ROADMAP · [ ] docs vivos → feito em ____
### PLAN AGAIN  — [ ] retro · [ ] carry-overs registrados · [ ] roadmap repriorizado · [ ] memória atualizada → próximo loop iniciado em ____

## Registro de verificação
_Preenchido na fase VERIFY: AC → evidência (nome do teste, captura de tela, saída do curl)._

## Resultado
_Preenchido na fase DOCUMENT: o que entregou, desvios, retro (3 linhas), carry-overs._
