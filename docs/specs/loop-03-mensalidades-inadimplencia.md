# Loop 03 — Mensalidades e inadimplência

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 03 · **Tamanho:** M · **Depende de:** Loop 2
**Arquivos tocados:** `db.js` (Mensalidade), `mensalidades.js` (puro), `server.js`, `public/app.js`

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
| Inadimplência | (em atraso ÷ total vencido) na competência | Definição simples e igual à dos concorrentes | Proposta |
| Vencimento padrão | Configurável por escola (dia do mês) | Cada escola combina o seu | Proposta |
| Juros/multa | Fora deste loop; campo de observação | Regra jurídica do contrato; decidir depois | Proposta |

## Critérios de aceite
- [ ] AC1 — "Gerar mensalidades de outubro" cria uma por criança particular ativa; repetir não duplica *(verificar: teste `AC1`)*
- [ ] AC2 — Criança com desconto de R$ 100 em mensalidade de R$ 800 gera cobrança de R$ 700 *(verificar: teste puro)*
- [ ] AC3 — Baixar uma mensalidade cria o lançamento de receita; desfazer remove *(verificar: teste `AC3`)*
- [ ] AC4 — Faixas de atraso classificam corretamente nos limites 30/31 e 60/61 dias *(verificar: teste puro `faixaAtraso`)*
- [ ] AC5 — Painel mostra "em aberto", "inadimplência %" e a lista de devedores por escola *(verificar: navegador com dados da demo)*
- [ ] AC6 — A mensagem de cobrança traz nome do responsável, mês e valor, sem CPF *(verificar: navegador)*

## Notas de design
- `Mensalidade { crianca_id, escola_id, competencia, valor_base, desconto, vencimento, pago_em, valor_pago, forma }`.
- `mensalidades.js` puro: `gerar`, `faixaAtraso(vencimento, hoje)`, `inadimplencia(mensalidades, hoje)`.
- Baixa liga `lancamento.mensalidade_id`.

## Configuração
Dia de vencimento padrão por escola (em Parâmetros).

## Tarefas
- [ ] 1. Modelo e funções puras com testes de fronteira
- [ ] 2. Endpoints gerar/baixar/desfazer
- [ ] 3. Aba "Mensalidades" e desconto no cadastro da criança
- [ ] 4. Cartão de inadimplência e devedores no Painel
- [ ] 5. Mensagem de cobrança copiável
- [ ] 6. Testes de API e VERIFY

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
