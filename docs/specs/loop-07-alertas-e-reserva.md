# Loop 07 — Alertas e reserva de rescisão

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 07 · **Tamanho:** M · **Depende de:** Loops 1 e 3 (usa contas e inadimplência)
**Arquivos tocados:** `alerts.js` (puro), `calc.js`, `server.js`, `public/app.js`

## Objetivo
O app avisa antes do problema: férias prestes a vencer (risco de pagar em dobro), conta de luz acima da média, caixa negativo nos próximos meses, contas vencendo e inadimplência alta. E provisiona todo mês uma reserva para rescisões, para o dia em que alguém sair não ser um susto no caixa.

## Escopo
**Dentro:**
- Central de alertas no Painel, calculada na hora (sem tarefa agendada)
- Alerta de férias: 60 dias antes do fim do período concessivo (deadline = admissão + 12×(períodos gozados+2) meses)
- Conta acima da média: > 20% sobre a média das competências anteriores disponíveis (até 3), por categoria
- Caixa negativo previsto nos próximos 3 meses (dentro do mesmo ano do relatório), com o valor
- Reserva de rescisão: provisão mensal = Σ (custo de rescisão sem justa causa de cada colaborador ativo, hipoteticamente em 31/12) × taxa de rotatividade ÷ 12

**Fora (explicitamente):**
- Notificação por e-mail/WhatsApp/push
- Alertas configuráveis pelo usuário (limites fixos por enquanto)
- Alerta de contas vencendo e de inadimplência alta: já existem como painéis dedicados (Loops 1 e 3); não estavam em nenhum AC deste loop, então ficam de fora — cortado na REFINEMENT
- Caixa negativo cruzando a virada do ano (dezembro→janeiro do ano seguinte): o relatório é só de um ano

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Taxa de rotatividade | Chute inicial de 20% ao ano, **campo editável por escola** em Parâmetros (`turnover_pct`), desligado por padrão (0%) | Sem histórico real não há como calcular um número melhor; como é editável e começa desligado, não bloqueia o loop — mas **ainda não confirmado com o dono** (pergunta 4 do ROADMAP continua aberta) | Confirmada como padrão editável (REFINEMENT); valor real ainda pendente do dono |
| Reserva na competência | Entra como campo `severanceProvision` por mês, dentro de `accrualCost`/`result`; nunca afeta o caixa (é provisão, não desembolso real) | Muda o lucro; não pode ser surpresa. Mesmo tratamento de `prov13`/`provFerias` | Confirmada (REFINEMENT) |
| Data hipotética da rescisão para a reserva | 31/12 do ano do relatório, para todo colaborador ativo | Simplificação: uma data fixa em vez de simular a demissão em cada mês (custaria caro e mudaria pouco) | Confirmada (REFINEMENT), simplificação documentada |
| Alertas sem agendador | Calculados a cada abertura do Painel | Simples e sempre atual; agendar só quando houver notificação | Confirmada (REFINEMENT) |

## Critérios de aceite
- [x] AC1 — Colaborador com prazo concessivo terminando em 45 dias gera alerta de férias; com 90 dias, não *(verificar: teste `AC1` de fronteira exata: 60 sim, 61 não)*
- [x] AC2 — Conta de uma categoria 25% acima da média das competências anteriores gera alerta; 15% não *(verificar: teste `AC2`, fronteira exata em 20%)*
- [x] AC3 — Saldo projetado negativo em algum dos próximos 3 meses (a partir do mês corrente) gera um alerta por mês, com o mês e o valor; um saldo negativo 4 meses no futuro ou num mês já passado não gera *(verificar: teste `AC3`)*
- [x] AC4 — Ligar a reserva de rescisão (`turnover_pct > 0`) reduz `totals.result` em exatamente Σ(custo de rescisão de cada ativo) × taxa, sem tocar `totals.cashOut`; com `turnover_pct = 0` (padrão), o relatório é **idêntico** ao de antes deste loop *(verificar: teste `AC4`, `assert.deepEqual` para o caso desligado + conta à mão para o ligado)*
- [x] AC5 — Sem nenhum alerta, o Painel mostra uma mensagem de "nenhum alerta", nunca um cartão vazio ou ausente *(verificar: navegador)*
- [x] AC6 — Ajuste/entrada inválida (colaborador sem admissão, taxa negativa) não derruba `generateAlerts` nem o endpoint: são ignorados silenciosamente ou vêm como aviso, nunca 500 *(verificar: teste `AC6` + teste de API)*

## Notas de design
- `alerts.js` puro: `vacationAlerts(employees, today)`, `billAboveAverageAlerts(bills, currentPeriod)`, `negativeCashAlerts(months, currentMonth)`, e o combinador `generateAlerts({ employees, bills, months, today, currentMonth })` → `[{ level, title, detail, action }]` (`level`: `warning`|`critical`; `action`: nome da aba relacionada).
- `calc.js`: `calculateSchool` ganha `severanceReserve = null` (`{ turnoverPct }`). Quando presente, soma o custo de rescisão (via `calculateSeverance`, importado de `severance.js`) de cada colaborador ativo com admissão registrada, hipoteticamente demitido sem justa causa em 31/12; `× turnoverPct ÷ 12` por mês, somado em `accrualCost`/`result` (nunca em `cashOut`). Colaborador sem `hire_date` é ignorado (não dá pra calcular).
- Endpoint `GET /api/alerts?year=&school=` monta o relatório, busca funcionários e contas da escola, e chama `generateAlerts`.
- Cartão "Alertas" no Painel, antes dos outros cartões; ícone/cor por `level`.

## Configuração
`turnover_pct` por escola (em Parâmetros; campo em `School`, padrão 0 = reserva desligada).

## Tarefas
- [x] 1. `alerts.js` com testes de fronteira (60/61 dias, 20%/25%, mês 3/4)
- [x] 2. `School.turnover_pct` em `db.js`; `severanceReserve` no `calc.js`, com teste de regressão (desligado = idêntico)
- [x] 3. Endpoint `GET /api/alerts`
- [x] 4. Cartão de alertas no Painel
- [x] 5. `npm run test:api` completo
- [x] 6. VERIFY com dados da demo montados para disparar cada alerta

## Registro de acompanhamento
### PLAN        — [ ] explorou o código · [ ] spec rascunhada · [ ] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (rotatividade fica editável, padrão 0%, pergunta ao dono continua registrada no ROADMAP) · [x] suposições conferidas · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-23
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (`turnover_pct`, campo em `School`, não variável de ambiente) → feito em 2026-09-23
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · [x] suíte completa · suítes: lógica 10/10 arquivos · API 42/42 → verde em 2026-09-23
### VERIFY      — [x] passeio no navegador + capturas (claro/escuro, desktop/celular) · [x] checklist de ACs · [x] sonda hostil · [x] regressão · [x] portas na rede · [x] números conferidos à mão (R$53.370,67 − R$35.567,62 = R$17.803,05) → tudo ✅ em 2026-09-23
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-23
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança) · [x] memória atualizada → próximo loop iniciado em 2026-09-23 (Loop 8 ou 9 — ver retro)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ `test-alerts.js`: 60 dias antes do prazo alerta, 61 não; teste de API confirmou com um colaborador real cujo prazo cai 45 dias no futuro a partir de hoje. Na demo, vários auxiliares com admissão antiga já dispararam o alerta (prazo já vencido, `level: critical`) |
| AC2 | ✅ `test-alerts.js`: 25% acima da média alerta, exatamente 20% não; teste de API e navegador confirmaram com uma conta de "Água" 100% acima da média dos 3 meses anteriores |
| AC3 | ✅ `test-alerts.js`: meses correntemês+1..+3 negativos alertam; correntemês+4 e o próprio mês corrente não; `currentMonth` falsy (relatório de outro ano) não gera nenhum |
| AC4 | ✅ `test.js` e teste de API: `turnover_pct=0` (ou omitido) é `assert.deepEqual` idêntico ao relatório sem a reserva; com 20%, `totals.result` cai exatamente `totals.severanceProvision`, e `totals.cashOut` não muda. Na demo: R$53.370,67 − R$35.567,62 = R$17.803,05, conferido à mão |
| AC5 | ✅ teste de API "AC5" e navegador: escola sem nenhum problema mostra "Nenhum alerta agora", nunca um cartão vazio ou ausente |
| AC6 | ✅ `test-alerts.js` (colaborador sem `hire_date`, conta com dados incompletos) e teste de API "AC6" (parâmetros inválidos no endpoint): sempre 400, nunca 500 |

**Os testes detectam regressão?** Quebrei o limite de dias (60→90) e o de percentual (20%→10%); os dois testes de fronteira falharam imediatamente. Código restaurado, suíte voltou a 10/10.

## Resultado

**Entregou:** `alerts.js` puro (`vacationAlerts`, `billAboveAverageAlerts`, `negativeCashAlerts`, `generateAlerts`); `School.turnover_pct` (padrão 0); `calc.js` ganhou `severanceReserve` (provisão mensal, nunca cash); endpoint `GET /api/alerts`; cartão "Alertas" no topo do Painel (funciona também com "Todas", somando os alertas de cada escola); campo de rotatividade em Parâmetros.

**Desvios:**
- Alertas de contas vencendo e de inadimplência alta ficaram fora — já existem como painéis dedicados desde os Loops 1 e 3, e não estavam em nenhum AC deste loop.
- **Pergunta 4 do ROADMAP (rotatividade real) continua aberta com o dono.** O app já funciona com qualquer valor, incluindo 0% (desligado, o padrão); só a exatidão do número depende de uma resposta.

**Retro:**
- **Ajudou:** a demo já tinha, sem eu montar nada, vários colaboradores disparando o alerta de férias (admissões antigas sem controle de período) — um sinal de que o alerta é realista, não um cenário de teste artificial.
- **Atrapalhou:** nada digno de nota; foi o loop mais direto desde o Loop 5, provavelmente por reusar `severance.js` inteiro sem precisar tocar nele.
- **Mudar no processo:** nenhuma mudança nova.

**Carry-overs:** nenhum novo além do que já estava registrado (pergunta 4 do ROADMAP).
