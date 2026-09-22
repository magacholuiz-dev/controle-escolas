# Loop 07 — Alertas e reserva de rescisão

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 07 · **Tamanho:** M · **Depende de:** Loops 1 e 3 (usa contas e inadimplência)
**Arquivos tocados:** `alertas.js` (puro), `calc.js`, `server.js`, `public/app.js`

## Objetivo
O app avisa antes do problema: férias prestes a vencer (risco de pagar em dobro), conta de luz acima da média, caixa negativo nos próximos meses, contas vencendo e inadimplência alta. E provisiona todo mês uma reserva para rescisões, para o dia em que alguém sair não ser um susto no caixa.

## Escopo
**Dentro:**
- Central de alertas no Painel, calculada na hora (sem tarefa agendada)
- Alerta de férias: 60 dias antes do fim do período concessivo
- Conta acima da média: > 20% sobre a média dos últimos 3 meses
- Caixa negativo previsto nos próximos 3 meses, com o valor
- Reserva de rescisão: provisão mensal = custo de rescisão sem justa causa de todos × taxa de rotatividade ÷ 12

**Fora (explicitamente):**
- Notificação por e-mail/WhatsApp/push
- Alertas configuráveis pelo usuário (limites fixos por enquanto)

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Taxa de rotatividade | ABERTA: chute inicial de 20% ao ano; a escola informa a real | Sem histórico não há como calcular; o dono sabe | ABERTA |
| Reserva na competência | Entra como linha "Provisão de rescisão", ligável/desligável | Muda o lucro; não pode ser surpresa | Proposta |
| Alertas sem agendador | Calculados a cada abertura do Painel | Simples e sempre atual; agendar só quando houver notificação | Proposta |

## Critérios de aceite
- [ ] AC1 — Colaborador com período concessivo terminando em 45 dias gera alerta de férias; com 90 dias, não *(verificar: teste `AC1` de fronteira)*
- [ ] AC2 — Conta de luz 25% acima da média dos 3 meses anteriores gera alerta; 15% não *(verificar: teste `AC2`)*
- [ ] AC3 — Saldo projetado negativo em algum dos próximos 3 meses gera alerta com o mês e o valor *(verificar: teste `AC3`)*
- [ ] AC4 — Ligar a reserva de rescisão reduz o lucro anual em exatamente Σ custo × taxa *(verificar: teste `AC4` + conta à mão)*
- [ ] AC5 — Sem nenhum problema, o Painel mostra "nenhum alerta" (nada de cartão vazio) *(verificar: navegador)*

## Notas de design
- `alertas.js` puro: `gerarAlertas({ relatorio, funcionarios, contas, mensalidades, hoje })` devolve `[{ nivel, titulo, detalhe, acao }]`.
- Reserva reusa `calcularRescisao` para o cenário "todos saem hoje sem justa causa".

## Configuração
`rotatividade_pct` por escola (em Parâmetros).

## Tarefas
- [ ] 1. `alertas.js` com testes de fronteira
- [ ] 2. Reserva de rescisão no `calc.js` atrás de flag
- [ ] 3. Cartão de alertas no Painel com link para a tela do problema
- [ ] 4. VERIFY com dados da demo montados para disparar cada alerta

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
