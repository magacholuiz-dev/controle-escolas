# Loop 01 — Contas a pagar: vencimento, baixa e fornecedores

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 01 · **Tamanho:** M · **Depende de:** Loop 0
**Arquivos tocados:** `db.js` (Conta, Fornecedor), `server.js`, `bills.js` (puro), `public/app.js`, `test/`

## Objetivo
Cada conta (água, luz, internet, segurança, fornecedores, compras) tem vencimento e status pendente/vencida/paga. Marcar como paga lança o realizado sozinho e alimenta o previsto x realizado. O Painel mostra o que vence nos próximos dias.

## Escopo
**Dentro:**
- Fornecedores (nome, documento, contato)
- Conta: escola, fornecedor, descrição, categoria, competência, vencimento, valor, pago em, valor pago
- Gerar as contas do mês a partir das despesas recorrentes (idempotente)
- Baixa (pagar) que cria o lançamento realizado ligado à conta
- Dividir uma conta entre as escolas (reusa `proration.js`)
- Aba "Contas a pagar" com filtros e cartão "vence em 7 dias" no Painel

**Fora (explicitamente):**
- Pagamento pela internet ou integração com banco
- Juros e multa por atraso
- Leitura de código de barras

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Status vencida | Derivado (`vencimento < hoje` e sem baixa), não gravado | Evita status desatualizado | Proposta |
| Baixa e lançamento | Baixa cria `Lancamento` com `conta_id`; desfazer baixa apaga o lançamento | Um só lugar de verdade para o realizado | Proposta |
| Valor pago diferente do previsto | Permitido | Contas reais variam (luz, juros) | Proposta |
| Fuso | Datas como texto `YYYY-MM-DD`, "hoje" pelo fuso America/Sao_Paulo | Mesmo padrão dos lançamentos; evita conta vencer um dia antes | Proposta |

## Critérios de aceite
- [x] AC1 — "Gerar contas de outubro" cria uma conta por despesa recorrente; rodar de novo não duplica *(verificar: teste `AC1`)*
- [x] AC2 — Conta com vencimento ontem e sem baixa aparece como vencida; paga aparece como paga *(verificar: teste puro de `statusConta` + navegador)*
- [x] AC3 — Pagar uma conta cria 1 lançamento com o valor pago; desfazer a baixa remove esse lançamento *(verificar: teste `AC3`)*
- [x] AC4 — Pagar com valor diferente do previsto atualiza a linha da categoria em "Despesas por categoria" *(verificar: navegador + relatório)*
- [x] AC5 — Conta de R$ 480,00 dividida entre as escolas gera duas contas ligadas, ao pagar uma a outra segue pendente *(verificar: teste `AC5`)*
- [x] AC6 — O cartão do Painel lista contas dos próximos 7 dias e as vencidas, com total *(verificar: navegador com dados da demo)*
- [x] AC7 — Valor negativo, vencimento inválido e fornecedor inexistente devolvem 400 *(verificar: teste `AC7`)*

## Notas de design
- Modelo `Conta`: `escola_id, fornecedor_id, despesa_id, descricao, categoria, competencia (YYYY-MM), vencimento, valor, pago_em, valor_pago, grupo_id`.
- `bills.js` puro: `statusConta(conta, hoje)`, `gerarContasDoMes(despesas, competencia, existentes)`.
- Endpoints: CRUD genérico + `POST /api/contas/gerar`, `POST /api/contas/:id/pagar`, `POST /api/contas/:id/desfazer`.
- Reusar `formDividir()` do front.

## Configuração
Nenhuma.

## Tarefas
- [x] 1. Modelos Fornecedor e Conta
- [x] 2. `bills.js` puro com testes
- [x] 3. Endpoints gerar/pagar/desfazer
- [x] 4. Aba "Contas a pagar" e cadastro de fornecedores
- [x] 5. Cartão de vencimentos no Painel
- [x] 6. Divisão de conta entre escolas
- [x] 7. Testes de API e passeio de VERIFY

## Registro de acompanhamento
### PLAN        — [x] explorou o código · [x] spec rascunhada · [x] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (todas Proposta, sem pendência do dono) · [x] suposições conferidas · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-22
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma variável nova) → feito em 2026-09-22
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · suítes: lógica 4/4 arquivos · API 11/11 → verde em 2026-09-22
### VERIFY      — [x] passeio no navegador + capturas · [x] checklist de ACs · [x] sonda hostil · [x] regressão · [x] listagem de portas na rede (sem mudança desde o Loop 0) · [x] números conferidos à mão → tudo ✅ em 2026-09-22
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-22
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança) · [x] memória atualizada → próximo loop iniciado em 2026-09-22 (Loop 2)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ teste "AC1": gerar duas contas (Segurança R$ 480, Internet R$ 250) para 2026-10; rodar de novo devolve `criadas:0`. Na tela: 7 despesas de Novo Mundo geraram 7 contas, todas "Pendente" |
| AC2 | ✅ teste "AC2": conta com vencimento ontem → `vencida`; amanhã → `pendente`; após pagar → `paga`. Status nunca gravado, sempre calculado contra a data de hoje |
| AC3 | ✅ teste "AC3": pagar com valor_pago=271,40 (diferente do previsto 250) cria o lançamento com esse valor; categoria "Luz" no previsto x realizado sobe para 271,40; pagar de novo dá 400; desfazer remove o lançamento e volta para "pendente"; desfazer de novo dá 400. Na tela: paguei a conta de Segurança (R$ 480) e `categorias.find(Segurança).realizado` foi para 480 |
| AC4 | (mesmo teste do AC3 — previsto x realizado por categoria já cobre este AC) |
| AC5 | ✅ teste "AC5": dividir conta de R$ 480 por crianças gera duas contas com o mesmo `grupo_id`; pagar a do Novo Mundo mantém a do CIC "pendente" |
| AC6 | ✅ teste "AC6" + navegador: criei uma conta vencendo em 3 dias, o cartão "Contas a pagar" do Painel mostrou "PRÓXIMOS 7 DIAS (R$ 321,00)"; uma conta vencendo em 18 dias não apareceu. Removida depois do teste |
| AC7 | ✅ teste "AC7": 11 casos (valor negativo/zero, vencimento com formato errado, competência com formato errado, fornecedor inexistente, gerar sem competência) devolvem 400; pagar/desfazer/editar/excluir conta inexistente devolvem 404 — corrigiu o carry-over do Loop 0 (`PUT`/`DELETE` de qualquer recurso agora respondem 404 quando o id não existe, não só contas) |

**Os testes detectam regressão?** Quebrei o código de propósito duas vezes: removi a checagem de "conta já paga" e desliguei a idempotência de `gerarContas`. Nas duas o teste de API correspondente falhou; código restaurado, 11/11.

## Resultado

**Entregou:** modelos `Fornecedor` e `Conta` (com índice único parcial despesa+competência); `bills.js` puro (`vencimentoDoMes`, `statusConta`, `gerarContasDoMes`, `resumoVencimentos`) com 4 testes de fronteira (fevereiro bissexto/não bissexto); endpoints `POST /contas/gerar`, `POST /contas/:id/pagar`, `POST /contas/:id/desfazer`, `GET /contas/painel`; `dividir` estendido para `contas`; aba "Contas a pagar" com geração por competência, status colorido e ações Pagar/Desfazer; aba "Fornecedores"; cartão de vencimentos no Painel; corrigido o carry-over do Loop 0 (id inexistente agora 404 em qualquer recurso, não só em contas).

**Desvios:**
- **AC4 não teve teste próprio**: o teste do AC3 já prova que o valor pago (diferente do previsto) aparece no previsto x realizado, então virou uma verificação conjunta em vez de duplicar o teste.
- **`dia_vencimento` por despesa** (não estava na spec original) substituiu um vencimento fixo por escola — despesas diferentes vencem em dias diferentes na vida real (aluguel dia 5, internet dia 15), e sem isso a geração ficaria menos útil. Campo opcional, padrão dia 10.
- Ação de "Pagar" na tela usa `prompt()` do navegador (valor e data), não um formulário próprio — funcional, mas cru; mesmo padrão do `alert()` de erro do Loop 0.

**Retro:**
- **Ajudou:** ter o carry-over do Loop 0 (404 em id inexistente) documentado tornou fácil perceber, na REFINEMENT, que a correção deveria ser genérica (em todos os recursos) e não só em `contas`.
- **Atrapalhou:** a rota `/api/contas/gerar` e `/api/contas/:id/pagar` quebraram o roteamento genérico original (que assumia sempre `recurso/id`). Precisei reestruturar a extração de segmentos da URL antes de implementar os sub-recursos.
- **Mudar no processo:** ao desenhar um endpoint de ação (verbo, não CRUD) sobre um recurso existente, checar primeiro se o roteador genérico assume "todo segundo segmento é um id" — vale um item na REFINEMENT.

**Carry-overs:**
1. Ação de pagar por `prompt()`; trocar por formulário/modal quando houver padrão de modal no app.
2. `dividir` de uma `conta` exige preencher competência e vencimento manualmente no formulário; poderia sugerir o vencimento a partir da competência (como `vencimentoDoMes` já faz no gerar).
3. Sem edição de fornecedor dentro da tela de Contas (é preciso ir à aba Fornecedores primeiro para cadastrar).
