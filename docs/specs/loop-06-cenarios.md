# Loop 06 — Cenários: e se a Prefeitura atrasar?

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 06 · **Tamanho:** M · **Depende de:** Loop 0 (Loop 2 melhora os cenários de matrícula)
**Arquivos tocados:** `cenarios.js` (puro), `calc.js`, `db.js` (Cenario), `server.js`, `public/app.js`

## Objetivo
Simular sem mexer nos dados reais: a Prefeitura atrasa N meses, perdemos ou ganhamos crianças, os salários sobem X% a partir de um mês, contratamos ou demitimos alguém (com a rescisão). O app compara o cenário com a base: saldo mínimo, mês crítico e reserva necessária.

## Escopo
**Dentro:**
- Cenário = conjunto de ajustes (overrides) sobre os dados reais
- Ajustes: atraso do repasse, variação de crianças, reajuste salarial, contratação/demissão, corte de despesa
- Comparação base x cenário lado a lado
- Salvar e reabrir cenários

**Fora (explicitamente):**
- Previsão estatística ou IA
- Cenários que gravam dados reais

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Atraso do repasse | Desloca a entrada de caixa N meses; a competência não muda | É exatamente a diferença entre lucro e caixa | Proposta |
| Como aplicar | `calc.js` continua puro e recebe `ajustes`; nenhuma escrita no banco | Cenário não pode sujar o real | Proposta |

## Critérios de aceite
- [ ] AC1 — Atrasar o repasse 2 meses mantém o lucro anual e piora o saldo mínimo *(verificar: teste `AC1` no cálculo)*
- [ ] AC2 — Cenário sem ajustes devolve exatamente o resultado da base *(verificar: teste `AC2`)*
- [ ] AC3 — Demitir um colaborador em junho inclui o custo da rescisão nesse mês e tira o salário dos seguintes *(verificar: teste `AC3` com `severance.js`)*
- [ ] AC4 — Salvar, reabrir e apagar um cenário não altera nenhum documento real *(verificar: teste `AC4` comparando as coleções antes e depois)*
- [ ] AC5 — A tela mostra base x cenário com a diferença do saldo mínimo em R$ *(verificar: navegador)*

## Notas de design
- `cenarios.js` puro: `aplicarAjustes(entradas, ajustes)` devolve novas entradas para `calcularEscola`.
- Ajuste é um objeto tipado `{ tipo, ... }`; validar com whitelist no servidor.

## Configuração
Nenhuma.

## Tarefas
- [ ] 1. Tipos de ajuste e `aplicarAjustes` com testes
- [ ] 2. Deslocamento de caixa no `calc.js` (sem quebrar os testes atuais)
- [ ] 3. Modelo Cenario e endpoints
- [ ] 4. Aba "Cenários"
- [ ] 5. VERIFY comparando à mão um atraso de 2 meses

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
