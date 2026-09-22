# Loop 10 — Conciliação bancária (OFX)

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 10 · **Tamanho:** M · **Depende de:** Loops 1 e 3
**Arquivos tocados:** `ofx.js`, `conciliacao.js` (puro), `db.js` (Extrato), `server.js`, `public/app.js`

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
| Formato | OFX apenas neste loop | Todo banco exporta; CSV varia por banco | Proposta |
| Identidade do movimento | Hash de conta + data + valor + id do banco (FITID) | Reimportar o mesmo arquivo não duplica | Proposta |
| Confirmação | Sempre humana; nunca baixa sozinho | Erro de conciliação é erro de dinheiro | Proposta |

## Critérios de aceite
- [ ] AC1 — Importar o mesmo OFX duas vezes deixa a mesma quantidade de movimentos *(verificar: teste `AC1`)*
- [ ] AC2 — Um débito de R$ 480,00 a 2 dias do vencimento de uma conta de R$ 480,00 é sugerido para ela; a 5 dias, não *(verificar: teste puro `sugerir`)*
- [ ] AC3 — Confirmar a sugestão baixa a conta e o lançamento; recusar não altera nada *(verificar: teste `AC3`)*
- [ ] AC4 — Movimento sem par vira lançamento na categoria escolhida *(verificar: navegador)*
- [ ] AC5 — OFX corrompido ou de tamanho absurdo é recusado com mensagem clara, sem derrubar o servidor *(verificar: teste `AC5`)*

## Notas de design
- `ofx.js` puro: parser tolerante (OFX 1.x é SGML, não XML).
- `conciliacao.js` puro: `sugerir(movimento, contas, mensalidades)` devolve candidatos com pontuação.

## Configuração
Nenhuma.

## Tarefas
- [ ] 1. Parser OFX com arquivos reais anonimizados de cada banco usado
- [ ] 2. `sugerir` com testes de fronteira
- [ ] 3. Modelo e endpoints de importação/confirmação
- [ ] 4. Tela de conciliação
- [ ] 5. VERIFY com o extrato de um mês real

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
