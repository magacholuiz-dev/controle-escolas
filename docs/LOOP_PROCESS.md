# Loop Engineering: PLAN → REFINEMENT → IMPLEMENT → TEST → VERIFY → DOCUMENT → PLAN AGAIN

Processo adaptado do Loop Engineering v2 usado no Kivoni (`lmfit-web/docs/ecommerce/LOOP_PROCESS.md`).
Um loop é um incremento entregável, guiado por **uma spec** em [`specs/`](./specs/) que carrega o
**Registro de acompanhamento** pelas sete fases. A spec é a fonte da verdade: se código e spec divergem,
corrija um dos dois antes de fechar o loop.

```
            ┌──────────────────────────── PLAN AGAIN ◄─────────────────────────┐
            ▼                                                                  │
   PLAN ──► REFINEMENT ──► IMPLEMENT ──► TEST ──► VERIFY ──► DOCUMENT ─────────┘
```

Cada fase tem **critério de entrada**, **checklist** (copiado na spec e marcado com evidência) e **portão de saída**.
Falha em TEST/VERIFY volta para IMPLEMENT; suposição quebrada volta para PLAN.

## Regras de base

- **Um loop por vez.** Termine (ou estacione com carry-overs registrados) antes de começar o próximo.
- **Specs são contratos executáveis:** todo critério de aceite (AC) nomeia como se verifica: um comando, um teste ou um passo no navegador que outra pessoa consiga repetir.
- **Nunca pule TEST nem VERIFY.** TEST = prova por código. VERIFY = prova no app rodando de verdade. "Testes passando" sozinho não fecha loop.
- **Dinheiro e dados pessoais:** salários, CPF, rescisões e dados de crianças são sensíveis (LGPD). Todo endpoint novo assume entrada hostil e devolve 400 (nunca 500) para dado inválido; nada de dado real em testes ou commits.
- **O servidor é a autoridade nos cálculos.** O front só exibe; regra de negócio mora em funções puras testáveis (`calc.js`, `rescisao.js`, `rateio.js` e as novas).
- **Funções puras primeiro:** lógica financeira nova nasce sem banco, com teste em `node:test`/`assert`, antes de ligar em Mongo e tela.
- **Portão de exposição:** nenhum loop pode publicar o app fora do computador local antes do Loop 8 (usuários e permissões) estar Done.

## Comandos do projeto

| Para | Comando |
|---|---|
| Subir o Mongo | `npm run db` (Docker precisa estar ligado) |
| App com dados de demonstração | `npm run demo` → http://localhost:3200 |
| Testes de lógica (sem banco) | `npm test` |
| Testes de API (com Mongo de teste) | `npm run test:api` (criado no Loop 0) |
| Backup | `npm run backup` (criado no Loop 0) |

## Ciclo de vida da spec

`Draft → Ready → In progress → Testing → Verifying → Done`

## Fase 1 — PLAN (rascunhar a spec)
**Entrada:** loop anterior Done (ou estacionado) e outline no ROADMAP.
- [ ] Ler carry-overs do loop anterior e as seções relevantes de `BENCHMARK.md`
- [ ] **Explorar o código real** que o loop toca e listar arquivos/endpoints na spec (nunca planejar de memória)
- [ ] Escrever Objetivo, Escopo (dentro/fora), primeiro rascunho de ACs e tarefas
- [ ] Listar decisões abertas com opções (ainda sem resolver)
- [ ] Listar riscos e incógnitas para atacar na REFINEMENT

**Saída:** spec `Draft`, linkada na tabela do ROADMAP.

## Fase 2 — REFINEMENT (desafiar a spec)
Onde escopo é cortado, ACs viram testáveis e decisões são resolvidas, antes de escrever código.
- [ ] Resolver toda decisão e registrar na tabela Decisões com o porquê (perguntar ao dono **agora**, nunca no meio da implementação)
- [ ] Conferir cada suposição no código (grep/leitura/curl)
- [ ] Reescrever cada AC até nomear a verificação *(verificar: …)*
- [ ] Cortar ou adiar o que não serve ao objetivo do loop (vai para Fora do escopo)
- [ ] Ordenar tarefas por dependência; quebrar qualquer uma maior que meio dia
- [ ] Revisão de Definition of Ready: escopo cabe, ACs testáveis, decisões resolvidas, tarefas ordenadas

**Saída:** spec `Ready`. Sem código antes deste portão.

## Fase 3 — IMPLEMENT (construir pequeno)
**Entrada:** spec `Ready`. Status vira `In progress`.
- [ ] Trabalhar a lista de tarefas de cima para baixo, marcando na spec
- [ ] Seguir os padrões existentes antes de inventar (CRUD genérico em `server.js`, modelos em `db.js`, `campo()`/`crud()`/`cartao()` em `public/app.js`)
- [ ] `node --check` em todo arquivo tocado e `npm test` verde a cada tarefa, não só no fim
- [ ] Novas variáveis de ambiente vão para `.env.example` e para a seção Configuração, no mesmo commit
- [ ] Bloqueio ou escopo descoberto volta para a spec, nunca é improvisado

**Saída:** todas as tarefas marcadas; checagem de sintaxe e testes verdes.

## Fase 4 — TEST (provar por código)
- [ ] Teste unitário para toda lógica nova com ramificação
- [ ] Cada AC testável tem ao menos um teste que o nomeia (`AC4: recusa valor negativo`)
- [ ] Caminhos negativos: entrada inválida, id inexistente, repetição/idempotência, valor limite (centavos, virada de ano, mês com 28 dias)
- [ ] Suítes completas verdes; **registrar as contagens** na spec
- [ ] Nenhum teste apagado ou enfraquecido para passar

**Saída:** suítes verdes cobrindo os ACs; contagens na spec.

## Fase 5 — VERIFY (provar ao vivo)
Testes não enxergam becos sem saída de UX. Aqui se anda pelo app de verdade.
- [ ] Percorrer o fluxo completo no navegador em `localhost:3200` (clicar, não só `curl`), com capturas de tela dos estados-chave, em tema claro e escuro e em largura de celular
- [ ] Marcar cada AC como `✅ verificado <como>` ou `❌ falhou`
- [ ] Sonda de entrada hostil em todo endpoint novo (id inválido, corpo vazio, texto onde deveria ser número) e, após o Loop 8, de acesso (sem login, papel errado)
- [ ] **Listar tudo o que escuta na rede** (`lsof -iTCP -sTCP:LISTEN -n -P`) e conferir cada porta aberta do projeto: app, banco, qualquer serviço novo
- [ ] Varredura de regressão nos fluxos vizinhos (Painel, rescisão, divisão de compras, calendário)
- [ ] **Conferir os números à mão** ao menos uma vez: o valor na tela bate com a conta feita fora do app
- [ ] Qualquer ❌ volta para IMPLEMENT; rodar TEST de novo antes de retornar

**Saída:** todo AC ✅ com evidência no Registro de verificação.

## Fase 6 — DOCUMENT (tornar durável)
- [ ] Spec: status `Done` e seção Resultado preenchida (o que entregou, desvios, evidências)
- [ ] ROADMAP: virar o status e adicionar linha no Changelog
- [ ] Atualizar docs vivos: `README.md`, `BENCHMARK.md` (coluna "Neste app"), `.env.example`
- [ ] Limpar: dados de teste, TODOs viram carry-overs

**Saída:** alguém novo consegue pegar o próximo loop só pelos docs.

## Fase 7 — PLAN AGAIN (retro → próximo loop)
- [ ] Retro em 3 linhas no Resultado: o que ajudou, o que atrapalhou, o que mudar no processo
- [ ] Carry-overs viram entrada do próximo PLAN ou novas linhas do ROADMAP
- [ ] Repriorizar: o próximo loop ainda faz sentido? Se não, reordenar com nota no Changelog
- [ ] Atualizar a memória do projeto (status do roadmap, próximo loop, fatos novos)
- [ ] Começar o PLAN do próximo loop

## Template de spec

Copie para `specs/loop-NN-<slug>.md`. Os arquivos atuais já seguem este formato.

Seções: Status/Depende de/Arquivos · Objetivo · Escopo (dentro/fora) · Decisões · Critérios de aceite ·
Notas de design · Configuração · Tarefas · Registro de acompanhamento (7 fases) · Registro de verificação · Resultado.

## Changelog do processo

| Data | Mudança |
|---|---|
| 2026-09-21 | VERIFY ganha "listar tudo o que escuta na rede" (Loop 0: o Mongo estava aberto à rede e só a varredura completa pegou) |
| 2026-09-21 | Adaptação do Loop Engineering v2 do Kivoni para este projeto: comandos Node/Mongo, portão de exposição, regra de funções puras e conferência manual dos números |
