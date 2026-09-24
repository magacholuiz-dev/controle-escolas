# Loop 10 — Conciliação bancária (OFX)

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 10 · **Tamanho:** M · **Depende de:** Loops 1 e 3
**Arquivos tocados:** `ofx.js`, `reconciliation.js` (puro), `db.js` (BankTransaction), `server.js`, `public/app.js`

## Objetivo
Importar o extrato do banco (OFX), o app sugere qual conta a pagar ou mensalidade cada movimento quitou, você confirma com um clique, e o que sobrar vira lançamento. O saldo do app passa a ser conferido com o do banco.

## Escopo
**Dentro:**
- Importar OFX de cada conta bancária das escolas
- Sugestão automática por valor e data (±3 dias) e nome do favorecido
- Confirmar/recusar sugestões; movimento sem par vira lançamento com categoria escolhida
- Comparação do saldo do app com o saldo final do extrato
- Não importar o mesmo movimento duas vezes

**Fora (explicitamente):**
- Open Finance e APIs bancárias
- Cobrança bancária (boleto, Pix, CNAB), estacionada
- Conciliação de cartão

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Formato | OFX apenas neste loop | Todo banco exporta; CSV varia por banco | Confirmada (REFINEMENT) |
| Identidade do movimento | Hash de escola + data + valor + FITID (`node:crypto`) | Reimportar o mesmo arquivo não duplica; índice único no banco | Confirmada (REFINEMENT) |
| Confirmação | Sempre humana; nunca baixa sozinho | Erro de conciliação é erro de dinheiro | Confirmada (REFINEMENT) |
| Modelagem de "conta bancária" | **Cortado**: um extrato é ligado à escola, não a uma conta bancária específica (sem modelo `BankAccount`) | Nenhum AC pede múltiplas contas por escola; adicionar isso sem um caso de uso concreto é especular | Confirmada (REFINEMENT), corte de escopo |
| Arquivos OFX reais para testar o parser | **Não disponíveis nesta sessão** — testado contra o formato público OFX 1.x (SGML) montado à mão, seguindo a especificação | Não sabemos qual banco as escolas usam (pergunta 5 do ROADMAP, ainda aberta); a especificação OFX é pública e estável, mas cada banco tem suas pequenas variações | **ABERTA** — funciona, mas carry-over: validar contra um extrato real quando houver um |
| Reconciliação com mensalidade | Movimento de **crédito** (entrada) só sugere mensalidade; movimento de **débito** (saída) só sugere conta a pagar | Um recebimento nunca paga uma conta, e vice-versa | Confirmada (REFINEMENT) |

## Critérios de aceite
- [x] AC1 — Importar o mesmo OFX duas vezes deixa a mesma quantidade de movimentos (a 2ª importação devolve `imported: 0, duplicates: N`) *(verificar: teste `AC1`)*
- [x] AC2 — Um débito de R$ 480,00 a 2 dias do vencimento de uma conta de R$ 480,00 é sugerido para ela; a exatamente 3 dias também; a 4 dias, não *(verificar: teste puro `suggest`, fronteira exata)*
- [x] AC3 — Confirmar a sugestão baixa a conta (ou mensalidade) e cria o lançamento; sem confirmar, nada muda (conta continua pendente, sem lançamento novo) *(verificar: teste `AC3`)*
- [x] AC4 — Movimento sem sugestão vira lançamento na categoria escolhida pelo usuário, ligado ao movimento *(verificar: teste `AC4` + navegador)*
- [x] AC5 — OFX sem nenhum `<STMTTRN>`/`<OFX>` reconhecível é recusado com mensagem clara (400), nunca derruba o servidor; corpo maior que 1&nbsp;MB já é recusado pelo limite global (413) *(verificar: teste `AC5`)*
- [x] AC6 — Um movimento malformado dentro de um OFX por outro lado válido é ignorado (pulado), sem invalidar o resto do arquivo *(verificar: teste `AC6`)*

## Notas de design
- `ofx.js` puro: `parseOfx(text)` → `{ transactions: [{ fitid, date, amount, name, type }], ledgerBalance, ledgerDate }`. Tolerante: converte SGML sem fechamento (`<TAG>valor`) para pseudo-XML (`<TAG>valor</TAG>`) com uma regex, depois extrai cada `<STMTTRN>` e o `<LEDGERBAL>` com regex simples — sem parser XML completo, sem dependência nova.
- `reconciliation.js` puro: `fingerprint({ schoolId, date, amount, fitid })` (sha256 de `node:crypto`); `suggest(transaction, { bills, tuitions })` → o melhor candidato (mesmo sinal: débito só casa com conta, crédito só com mensalidade; valor igual; vencimento a até 3 dias) ou `null`.
- `BankTransaction` (Mongoose): `{ school_id, fitid, date, amount, name, fingerprint (índice único), suggested_kind, suggested_id, reconciled, entry_id }`.
- Confirmar a sugestão reusa `payBill`/`payTuition` já existentes (Loops 1/3) — nenhuma lógica de pagamento nova.

## Configuração
Nenhuma variável nova. O limite de tamanho do OFX é o limite global do corpo da requisição (`MAX_BODY`, 1&nbsp;MB, do Loop 0).

## Tarefas
- [x] 1. `ofx.js` com testes contra OFX montado à mão (SGML sem fechamento, tolerante a linha malformada)
- [x] 2. `reconciliation.js` (`fingerprint`, `suggest`) com testes de fronteira
- [x] 3. Modelo `BankTransaction` e endpoints (importar, listar, confirmar, lançar manualmente)
- [x] 4. Aba "Conciliação"
- [x] 5. `npm run test:api` completo
- [x] 6. VERIFY com um OFX montado à mão (sem extrato real disponível — carry-over registrado)

## Registro de acompanhamento
### PLAN        — [x] explorou o código · [x] spec rascunhada · [x] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (uma ABERTA e assumida como carry-over: sem arquivo real de banco) · [x] suposições conferidas (`payBill`/`payTuition` relidos) · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-23
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma var nova) → feito em 2026-09-23
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · suítes: lógica 12/12 · API 53/53 → verde em 2026-09-23
### VERIFY      — [x] passeio no navegador + capturas · [x] checklist de ACs · [x] sonda hostil (OFX inválido, mobile 375px) · [x] regressão (suíte completa) · [x] números conferidos à mão (bill R$250 pago pelo extrato) → tudo ✅ em 2026-09-23
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-23
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado · [x] memória atualizada → próximo loop iniciado em 2026-09-23

## Registro de verificação
| AC | Evidência |
|---|---|
| AC1 | `test/api/reconciliation.test.js` "AC1: importing the same OFX twice never duplicates transactions"; confirmado à mão via curl (`imported:1,duplicates:0` depois `imported:0,duplicates:2`) |
| AC2 | `test-reconciliation.js` (fronteira 2/3/4 dias, mutação testada) |
| AC3 | `test/api/reconciliation.test.js` "AC3"; confirmado à mão: conta "Internet" R$250 ficou `overdue` até o `POST /api/bank/:id/confirm`, depois `paid`, com o lançamento aparecendo em `/api/entries`; UI mostrou "Conciliado" e sem botões após o navegador recarregar |
| AC4 | `test/api/reconciliation.test.js` "AC4"; testado na UI: aba "Conciliação bancária" lista o movimento com sugestão e o botão "Lançar manualmente" |
| AC5 | `test/api/reconciliation.test.js` "AC5"; confirmado que o servidor continua respondendo (`GET /api/schools` 200) depois do 400 |
| AC6 | `test/api/reconciliation.test.js` "AC6"; `test-ofx.js` no nível puro |

## Resultado
Entregou importação de extrato OFX com dedup por fingerprint (escola+data+valor+FITID), sugestão automática de conta/mensalidade por valor exato e janela de ±3 dias, confirmação humana (nunca automática) que reusa `payBill`/`payTuition`, lançamento manual para movimentos sem par, e a aba "Conciliação bancária" no front (upload de arquivo, tabela de movimentos, botões de ação). Nenhuma dependência nova.

Desvio do plano original: a resposta de importação usa o campo `duplicates` (como já estava no AC1), não `skipped` como eu escrevi de primeira — corrigido antes do TEST.

Retro:
1. Reaproveitar `payBill`/`payTuition` em vez de escrever uma baixa "de mentira" evitou qualquer lógica de pagamento divergente entre o fluxo manual e o da conciliação.
2. `sed -i` com um padrão de várias palavras/parênteses quebrou por escaping do shell — o Edit tool resolveu de primeira; vale usar Edit sempre que o padrão tiver parênteses ou aspas.
3. Testar o parser OFX contra arquivo sintético (sem exemplo real de banco) é uma lacuna honesta — funciona contra a especificação pública, mas pequenas variações de banco só aparecem com um extrato de verdade.

Carry-overs:
- Validar o parser OFX contra um extrato real, quando a escola disponibilizar um.
- Aba "Conciliação" não tem uma visão de comparação de saldo (saldo do extrato vs. saldo do app) — o `ledgerBalance`/`ledgerDate` já vêm da importação mas não são exibidos ainda; considerar mostrá-los como um card do tipo "confere/não confere" num loop futuro.
- Confirmar uma sugestão sempre paga com a data do movimento bancário e o valor exato do movimento; não há UI para escolher outro valor/data na hora de confirmar (só via "lançar manualmente").
