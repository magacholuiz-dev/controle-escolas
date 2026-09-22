# Loop 03 — Mensalidades e inadimplência

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 03 · **Tamanho:** M · **Depende de:** Loop 2
**Arquivos tocados:** `db.js` (Mensalidade), `tuition.js` (puro), `server.js`, `public/app.js`

## Objetivo
As mensalidades das vagas particulares são geradas por mês, baixadas quando pagas e classificadas por atraso. O Painel mostra quanto está em aberto, a inadimplência do mês e quem deve, com texto de cobrança pronto para copiar.

## Escopo
**Dentro:**
- Gerar mensalidades da competência para cada criança de vaga particular (idempotente)
- Desconto por criança (irmãos, bolsa)
- Baixa manual com forma de pagamento; a baixa cria o lançamento de receita
- Faixas de atraso (1–30, 31–60, 60+) e taxa de inadimplência
- Lista de devedores com mensagem de cobrança copiável

**Fora (explicitamente):**
- Boleto, Pix cobrança e remessa/retorno bancário (estacionado, precisa de banco)
- Envio automático por WhatsApp/e-mail
- Juros e multa automáticos

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Inadimplência | Σ valor das mensalidades vencidas e não pagas ÷ Σ valor de todas as vencidas (pagas ou não), na competência | Definição simples e igual à dos concorrentes; vencidas = `vencimento <= hoje` | Confirmada (REFINEMENT) |
| Vencimento padrão | Campo `dia_vencimento_mensalidade` por escola (Parâmetros), padrão dia 10 — mesmo padrão do `dia_vencimento` das despesas (Loop 1) | Cada escola combina o seu; reusa um padrão já existente no código | Confirmada (REFINEMENT) |
| Juros/multa | Fora deste loop; sem campo dedicado (usar o `desconto`, que aceita negativo, se for preciso ajustar manualmente) | Regra jurídica do contrato; decidir depois | Confirmada (REFINEMENT) |
| Quem gera mensalidade | Só crianças com `tipo_vaga === 'particular'` (campo já existe desde o Loop 2, incluindo `mensalidade`) | Reusa o cadastro existente, sem novo campo em Crianca | Confirmada (REFINEMENT) |
| Desconto negativo (agravo) | Permitido — `valor_cobranca = max(0, valor_base - desconto)`, nunca fica negativo | Cobre bolsa/desconto (positivo) sem impedir um ajuste manual para cima (desconto negativo), documentado como uso avançado | Confirmada (REFINEMENT) |

## Critérios de aceite
- [x] AC1 — "Gerar mensalidades de outubro" cria uma para cada criança de vaga `particular` ativa nesse mês (usa `fracaoAtivaNoMes` do Loop 2 para decidir "ativa"); repetir não duplica (índice único `crianca_id+competencia`) *(verificar: teste `AC1`)*
- [x] AC2 — Criança com `mensalidade=800` e `desconto=100` gera `valor_cobranca=700`; desconto maior que o valor nunca gera cobrança negativa *(verificar: teste puro `calcularCobranca`)*
- [x] AC3 — Baixar uma mensalidade com forma de pagamento cria o lançamento de receita (categoria "Mensalidades"); baixar de novo dá 400; desfazer remove o lançamento e devolve ao estado pendente; desfazer sem estar paga dá 400 *(verificar: teste `AC3`)*
- [x] AC4 — Faixas de atraso: 0 dias de atraso = `em_dia`; exatamente 30 = `1-30`; exatamente 31 = `31-60`; exatamente 60 = `31-60`; 61 = `60+`; mensalidade paga nunca é "em atraso", mesmo vencida *(verificar: teste puro `faixaAtraso`, nos 5 limites)*
- [x] AC5 — Painel mostra total em aberto, % de inadimplência e a lista de devedores por escola, com valor e dias de atraso *(verificar: teste de API + navegador com dados da demo)*
- [x] AC6 — A mensagem de cobrança traz nome do responsável, competência e valor, nunca CPF nem dado de outro responsável *(verificar: teste puro `mensagemCobranca` + navegador)*
- [x] AC7 — Gerar mensalidade sem crianças particulares cadastradas devolve `criadas:0` sem erro; desconto negativo maior que o valor, competência ou vencimento em formato errado devolvem 400 *(verificar: teste `AC7`)*

## Notas de design
- `Mensalidade { crianca_id, escola_id, competencia, valor_base, desconto, vencimento, pago_em, valor_pago, forma_pagamento }`; índice único `{crianca_id, competencia}`.
- `Lancamento` ganha `mensalidade_id` (mesmo padrão do `conta_id` do Loop 1).
- `tuition.js` puro: `calcularCobranca(valorBase, desconto)`, `gerarMensalidadesDoMes(criancas, competencia, diaVencimento)` (reusa `estaAtivaEm`/`fracaoAtivaNoMes` de `children.js`), `faixaAtraso(vencimento, hoje, pago)`, `inadimplencia(mensalidades, hoje)`, `mensagemCobranca(mensalidade, crianca, nomeEscola)`.
- Endpoints e rotas seguem exatamente o padrão de `bills.js`/`server.js` do Loop 1: `POST /mensalidades/gerar`, `POST /mensalidades/:id/pagar`, `POST /mensalidades/:id/desfazer`, `GET /mensalidades/painel`.
- `Escola.dia_vencimento_mensalidade` (padrão 10), editável em Parâmetros.

## Configuração
Dia de vencimento padrão por escola (em Parâmetros).

## Tarefas
- [x] 1. Modelo e funções puras com testes de fronteira
- [x] 2. Endpoints gerar/baixar/desfazer
- [x] 3. Aba "Mensalidades" e desconto no cadastro da criança
- [x] 4. Cartão de inadimplência e devedores no Painel
- [x] 5. Mensagem de cobrança copiável
- [x] 6. Testes de API e VERIFY

## Registro de acompanhamento
### PLAN        — [x] explorou o código · [x] spec rascunhada · [x] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (todas nossas, sem pendência do dono) · [x] suposições conferidas (Crianca já tem `tipo_vaga`/`mensalidade` do Loop 2) · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-22
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma variável nova) → feito em 2026-09-22
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · suítes: lógica 6/6 arquivos · API 21/21 → verde em 2026-09-22
### VERIFY      — [x] passeio no navegador + capturas (claro/escuro, desktop/celular) · [x] checklist de ACs · [x] sonda hostil · [x] regressão · [x] portas na rede (3200 e 27019 seguem recusando a rede) · [x] números conferidos à mão → tudo ✅ em 2026-09-22
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-22
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado · [x] memória atualizada → próximo loop iniciado em ____ (Loop 4 ainda não começou; sem decisão pendente que o bloqueie)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ teste de API "AC1": 3 crianças (particular com valor, particular sem valor, vaga da prefeitura) geram exatamente 1 mensalidade; repetir devolve `criadas:0`. Na demo, o vencimento saiu no dia configurado em Parâmetros (5) |
| AC2 | ✅ `test-tuition.js` (`calcularCobranca`) e teste de API "AC2": R$800 com desconto de R$100 vira R$700; desconto maior que o valor nunca fica negativo |
| AC3 | ✅ teste de API "AC3": pagar cria o lançamento; pagar de novo dá 400; desfazer remove o lançamento e permite pagar de novo; desfazer sem estar paga dá 400. Verificado também na tela: paguei pela aba Mensalidades e a mensalidade saiu do cartão de atraso do Painel |
| AC4 | ✅ `test-tuition.js`: 0, 30, 31, 60 e 61 dias de atraso nos limites exatos; mensalidade paga nunca é "em atraso" mesmo com vencimento passado |
| AC5 | ✅ teste de API "AC5 e AC6" + navegador: cadastrei uma mensalidade vencida há 40 dias com desconto de R$50 (R$800 → R$750); o Painel mostrou "R$750,00 em atraso de R$750,00 vencidos · inadimplência de 100%" e a linha da devedora com a faixa "Atraso 31–60 dias" |
| AC6 | ✅ mesmo teste + navegador: a mensagem copiada foi "Olá, Sra. Helena Mãe, a mensalidade de Helena Teste (Novo Mundo) referente a agosto/2026 está no valor de R$ 750,00, com vencimento em 13/08/2026." — sem CPF; o teste de API também garante que o telefone do responsável (que não pedimos no painel) não aparece na resposta |
| AC7 | ✅ teste de API "AC7": gerar numa escola sem nenhuma criança particular devolve `criadas:0` sem erro; competência/vencimento com formato errado, escola ou criança inexistente devolvem 400/404 |

**Os testes detectam regressão?** Quebrei o código de propósito duas vezes: removi a checagem de "mensalidade já paga" (pegou no teste de API "AC3") e removi o `Math.max(0, …)` de `calcularCobranca` (pegou no teste puro, com desconto maior que o valor virando negativo). Nas duas o teste correspondente falhou; código restaurado, 6/6 arquivos de lógica e 21/21 na API.

## Resultado

**Entregou:** modelo `Mensalidade` (com índice único `crianca_id+competencia`); `dia_vencimento_mensalidade` em `Escola`; `mensalidade_id` em `Lancamento`; `tuition.js` puro (`calcularCobranca`, `gerarMensalidadesDoMes`, `faixaAtraso`, `inadimplencia`, `mensagemCobranca`), reusando `fracaoAtivaNoMes`/`estaAtivaEm` do Loop 2; endpoints `POST /mensalidades/gerar`, `POST /mensalidades/:id/pagar`, `POST /mensalidades/:id/desfazer`, `GET /mensalidades/painel`, seguindo exatamente o padrão de `bills.js`/Loop 1; aba "Mensalidades" com geração por competência, status colorido e ações Pagar/Desfazer; cartão "Mensalidades em atraso" no Painel, com % de inadimplência e botão "Copiar mensagem" por devedor.

**Desvios:**
- Nenhum desvio das decisões da REFINEMENT — todas eram nossas (Proposta), sem pendência do dono, e todas foram implementadas como escritas.
- Ação de pagar mensalidade usa `prompt()`, mesmo padrão (e mesmo carry-over) das contas do Loop 1.

**Retro:**
- **Ajudou:** seguir literalmente o padrão de `bills.js` (mesmos nomes de rota, mesma forma de calcular status, mesmo formato de teste) tornou a implementação rápida e sem decisões novas de arquitetura — o loop virou "aplicar o mesmo padrão a um domínio novo".
- **Atrapalhou:** nada de relevante; foi o loop mais tranquilo até agora, provavelmente por reusar tanto código dos Loops 1 e 2.
- **Mudar no processo:** nenhuma mudança — o processo se provou bem no ponto em que um loop reusa fortemente os anteriores.

**Carry-overs:**
1. Sem juros/multa automáticos em mensalidade atrasada; o campo `desconto` aceita valor negativo como agravo manual, mas isso não está documentado na tela, só no código e nesta spec.
2. Cadastro manual de mensalidade (fora do "gerar") não confere se a criança pertence à escola informada em `escola_id` — poderia cadastrar a mensalidade de uma criança do Novo Mundo na conta do CIC sem erro.
3. Ação de pagar continua por `prompt()` (mesmo carry-over dos Loops 0/1, ainda não resolvido).
