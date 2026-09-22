# Loop 02 — Crianças, turmas e receita derivada da matrícula

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 02 · **Tamanho:** L · **Depende de:** Loop 0
**Arquivos tocados:** `db.js` (Crianca, Contrato, Calendario), `criancas.js` (puro), `calc.js`, `server.js`, `public/app.js`

## Objetivo
A receita deixa de ser um número digitado: vem das crianças matriculadas. Cada escola cadastra as crianças (vaga da Prefeitura ou particular) e o valor do contrato; a receita da Prefeitura passa a ser crianças × valor × dias letivos do mês, e o "fator de repasse" sai dos dias letivos.

## Escopo
**Dentro:**
- Cadastro de criança: nome, nascimento, turma, responsável (nome e telefone), tipo de vaga, mensalidade (particular), datas de matrícula e saída
- Contrato da Prefeitura por escola: valor por criança e por dia (ou por mês, ver decisão) e vigência
- Dias letivos por mês no calendário; fator de repasse = dias letivos ÷ dias do contrato
- Receita prevista derivada, com o modo manual atual mantido como alternativa
- Ocupação: crianças ÷ capacidade da escola

**Fora (explicitamente):**
- Frequência diária de cada criança
- Documentos, saúde, autorizações
- Portal dos pais

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Como a Prefeitura de Curitiba calcula o repasse | ABERTA: por criança e por dia letivo? valor mensal por vaga? há teto de vagas? | Define a fórmula central do loop. Perguntar ao dono ou pegar o texto do contrato | ABERTA |
| Entrada/saída no meio do mês | Proporcional aos dias | É como o repasse por dia funciona; confirmar com o contrato | ABERTA |
| Dados da criança e LGPD | Coletar o mínimo: sem CPF da criança; contato do responsável opcional | São dados de menores; só o necessário | Proposta |
| Turma | Texto livre por enquanto | Model `Turma` só se o Loop 4 precisar de centro de custo por turma | Proposta |

## Critérios de aceite
- [ ] AC1 — Cadastrar uma criança de vaga da Prefeitura aumenta a receita prevista do mês em (valor × dias letivos) *(verificar: teste puro + navegador)*
- [ ] AC2 — Criança que sai no dia 10 gera receita proporcional nesse mês e zero nos seguintes *(verificar: teste `AC2`)*
- [ ] AC3 — Mudar os dias letivos de fevereiro de 20 para 10 muda o fator para 50% e a receita junto *(verificar: teste `AC3`)*
- [ ] AC4 — Escolas sem crianças cadastradas continuam usando a receita manual, sem mudar nenhum número existente *(verificar: teste de regressão do `calc.js` + Painel)*
- [ ] AC5 — Painel e aba Crianças mostram ocupação (ex.: 62 de 70 vagas) *(verificar: navegador)*
- [ ] AC6 — Exportar/listar crianças não expõe telefone do responsável a quem não tem permissão (após Loop 8) *(verificar: sonda de acesso no Loop 8)*

## Notas de design
- Modelo `Crianca`, `Contrato { escola_id, valor, unidade: dia|mes, vigencia_ini, vigencia_fim }`, `Calendario.dias_letivos`.
- `criancas.js` puro: `receitaPrefeitura({ criancas, contrato, diasLetivos, mes, ano })` com proporcionalidade de entrada e saída.
- `calc.js` recebe a receita derivada como uma linha a mais em `receitas`, sem reescrever o cálculo.

## Configuração
Nenhuma.

## Tarefas
- [ ] 1. **Bloqueante:** resolver a fórmula de repasse com o dono (REFINEMENT)
- [ ] 2. Modelos Crianca e Contrato; dias letivos no calendário
- [ ] 3. `criancas.js` puro com testes de fronteira (virada de mês, ano bissexto, saída no dia 1)
- [ ] 4. Integrar no `calc.js` mantendo o modo manual
- [ ] 5. Aba "Crianças" e "Contrato"
- [ ] 6. Ocupação no Painel
- [ ] 7. VERIFY comparando com uma fatura real da Prefeitura

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
