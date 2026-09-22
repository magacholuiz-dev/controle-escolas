# Loop 02 — Crianças, turmas e receita derivada da matrícula

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 02 · **Tamanho:** L · **Depende de:** Loop 0
**Arquivos tocados:** `db.js` (Crianca, Contrato, Calendario), `children.js` (puro), `calc.js`, `server.js`, `public/app.js`

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
| Como a Prefeitura de Curitiba calcula o repasse | **Resolvida com o dono (2026-09-22): valor por criança × dias letivos** | Confirmado pelo dono | Resolvida |
| Entrada/saída no meio do mês | **Resolvida com o dono (2026-09-22): proporcional aos dias** | Confirmado pelo dono | Resolvida |
| Como fazer a proporção de dias, sem calendário letivo dia a dia | Fração = dias corridos matriculada no mês ÷ dias corridos do mês; aplicada sobre (valor por criança-dia × dias letivos do mês) | O app não tem o calendário letivo dia a dia (só o total de dias letivos do mês); distribuir os dias letivos uniformemente ao longo do mês civil é a aproximação mais simples e defensável. **Confirmar com o dono se o resultado bate com uma fatura real na VERIFY** | Proposta |
| Contrato com vigência por período | **Cortado deste loop**: um único campo `valor_dia_crianca` por escola (Parâmetros), sem data de início/fim | Contrato com vigência é raro mudar no meio do ano; adiciona uma coleção e uma tela sem benefício claro agora. Se o valor mudar, edita-se direto e vale a partir da edição | Proposta (corte de escopo) |
| Convivência com a receita manual "Contrato Prefeitura" | Quando a escola tem ao menos uma criança de vaga `prefeitura` cadastrada, as receitas manuais com `segue_calendario=1` **deixam de contar** (a derivada assume o lugar); sem crianças cadastradas, nada muda (AC4) | Evita contar a Prefeitura duas vezes sem depender do usuário lembrar de apagar a receita manual | Proposta |
| Rateio por crianças (Loop 1) usa o quê | Fora de escopo: continua usando o campo manual `escola.criancas`, não a contagem real da coleção `Crianca` | Loop 1 já está Done; trocar a fonte dessa contagem é uma mudança própria, não um efeito colateral deste loop | Proposta (fora de escopo, ver carry-over) |
| Dados da criança e LGPD | Coletar o mínimo: sem CPF da criança; contato do responsável opcional | São dados de menores; só o necessário | Proposta |
| Turma | Texto livre por enquanto | Model `Turma` só se o Loop 4 precisar de centro de custo por turma | Proposta |

## Critérios de aceite
- [x] AC1 — Uma criança de vaga `prefeitura`, matriculada o mês inteiro em um mês com 20 dias letivos e `valor_dia_crianca=15`, soma R$ 300,00 à receita do mês *(verificar: teste puro `receitaPrefeituraMes` + teste de API)*
- [x] AC2 — Criança que sai no dia 10 de um mês de 20 dias corridos gera 50% da receita cheia nesse mês e zero nos meses seguintes *(verificar: teste `AC2` de `fracaoAtivaNoMes`)*
- [x] AC3 — Mudar `dias_letivos` de fevereiro de 20 para 10 corta a receita derivada de fevereiro pela metade, sem afetar o `fator` (que continua regendo despesas) *(verificar: teste `AC3`)*
- [x] AC4 — Escola sem nenhuma criança cadastrada mantém exatamente os mesmos números de receita de antes do loop *(verificar: teste de regressão que roda a mesma entrada de `test.js` com `criancas: []` e compara byte a byte)*
- [x] AC4b — Escola com crianças cadastradas (tipo `prefeitura`) para de somar as receitas manuais com `segue_calendario=1`, sem exigir que o usuário as apague *(verificar: teste `AC4b`)*
- [x] AC5 — Painel e aba Crianças mostram ocupação (ex.: 62 de 70 vagas) quando a escola tem `capacidade` preenchida; sem capacidade, mostra "—" em vez de dividir por zero *(verificar: teste puro `ocupacao` + navegador)*
- [ ] AC6 — Exportar/listar crianças não expõe telefone do responsável a quem não tem permissão *(adiado para o Loop 8, que ainda não existe; até lá, todo o app é de acesso livre a quem está no `127.0.0.1` — mesma situação de todos os outros dados sensíveis)*
- [x] AC7 — Data de saída antes da data de matrícula, `valor_dia_crianca` negativo e `dias_letivos` fora de 0–31 devolvem 400 *(verificar: teste `AC7`)*

## Notas de design
- Modelo `Crianca` (sem CPF); campos `capacidade` e `valor_dia_crianca` em `Escola`; `dias_letivos` em `Calendario` (sem afetar `fator`).
- `children.js` puro: `fracaoAtivaNoMes`, `receitaPrefeituraMes`, `ocupacao`, `estaAtivaEm`. Sem modelo `Contrato` (corte de escopo, ver Decisões).
- `calc.js`: receita manual `segue_calendario` é supersedida quando há crianças de vaga `prefeitura`; a derivada assume o lugar. Sem crianças cadastradas, comportamento idêntico ao anterior (prova por `deepEqual` em `test.js`).

## Configuração
Nenhuma.

## Tarefas
- [x] 1. Resolver a fórmula de repasse com o dono (REFINEMENT) — respondida em 2026-09-22
- [x] 2. Modelo Crianca; `capacidade`/`valor_dia_crianca` em Escola; `dias_letivos` no calendário (sem Contrato — corte de escopo)
- [x] 3. `children.js` puro com testes de fronteira (mês inteiro, saída/matrícula no meio do mês, sem capacidade)
- [x] 4. Integrar no `calc.js` mantendo o modo manual (prova de regressão por `deepEqual`)
- [x] 5. Aba "Crianças" (sem aba "Contrato" — não existe mais esse modelo)
- [x] 6. Ocupação no Painel e na aba Crianças
- [ ] 7. VERIFY comparando com uma fatura real da Prefeitura *(carry-over: não havia fatura disponível nesta sessão)*

## Registro de acompanhamento
### PLAN        — [x] explorou o código · [x] spec rascunhada · [x] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (dono respondeu em 2026-09-22: valor por criança × dias letivos, proporcional aos dias) · [x] suposições conferidas · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-22
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma variável nova) → feito em 2026-09-22
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · suítes: lógica 5/5 arquivos · API 16/16 → verde em 2026-09-22
### VERIFY      — [x] passeio no navegador + capturas (claro/escuro, desktop/celular) · [x] checklist de ACs · [x] sonda hostil · [x] regressão · [x] portas na rede (3200 e 27019 seguem recusando a rede) · [x] números conferidos à mão → tudo ✅ em 2026-09-22
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-22
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança) · [x] memória atualizada → próximo loop iniciado em 2026-09-22 (Loop 3)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ `test-children.js`: 1 criança, 20 dias letivos, R$15/dia = R$300. Teste de API "AC1 e AC4b" reproduz isso contra o Mongo real |
| AC2 | ✅ `test-children.js` (`fracaoAtivaNoMes`) e teste de API "AC2": criança que sai no dia 10 de abril (30 dias corridos) gera 10/30 da receita cheia em abril e zero em maio |
| AC3 | ✅ teste de API "AC3": `dias_letivos` de fevereiro 20→10 corta a receita derivada pela metade; o `fator` de fevereiro (usado pelas despesas) não muda, e a despesa "Alimentação" continua exatamente `valor_mensal × fator` |
| AC4 | ✅ `test.js`: `calcularEscola({ ...base, criancas: [], diasLetivos: [] })` é **idêntico** (`assert.deepEqual`) a chamar sem passar esses parâmetros — prova mecânica de que nada mudou para quem não usa a feature |
| AC4b | ✅ mesmo teste "AC1 e AC4b": com 1 criança cadastrada, a receita manual de R$60.000 "segue calendário" para de contar; a receita do mês passa a ser só a derivada (R$300). Na demo ao vivo: setembro caiu de R$67.500 para R$7.800 (R$7.500 de mensalidades particulares, que não seguem calendário, + R$300 derivados) |
| AC5 | ✅ `test-children.js` (`ocupacao`) e teste de API "AC5": sem capacidade cadastrada, `capacidade` e `pct` vêm `null` (nunca `NaN`/`Infinity`); com capacidade 70 e 1 criança ativa, `pct = 1/70`. Na tela, o cartão "Ocupação" mostrou "1 / 70 · 1,4% das vagas" |
| AC6 | Adiado — depende do Loop 8, que ainda não existe |
| AC7 | ✅ teste de API "AC7": data de saída antes da matrícula (na criação e numa edição parcial que colide com a matrícula já salva) e `dias_letivos=32` devolvem 400; escola inexistente na ocupação devolve 404 |

**Os testes detectam regressão?** Quebrei o código de propósito duas vezes: desliguei a regra de "supersede" (receita manual e derivada passavam a somar as duas) e fiz `fracaoAtivaNoMes` sempre devolver 1 (ignorando entrada/saída no meio do mês). Nas duas os testes de API falharam (2 testes diferentes); código restaurado, 16/16.

## Resultado

**Entregou:** modelo `Crianca` (com `tipo_vaga`, matrícula/saída, sem CPF); campos novos em `Escola` (`capacidade`, `valor_dia_crianca`) e em `Calendario` (`dias_letivos`, com padrão automático ao criar o calendário do ano); `children.js` puro (`fracaoAtivaNoMes`, `receitaPrefeituraMes`, `ocupacao`, `estaAtivaEm`) com 13 asserções de fronteira; `calc.js` estendido com a receita derivada e a regra de "supersede" da receita manual, mantendo 100% de compatibilidade quando não há crianças cadastradas (prova por `deepEqual`); endpoint `GET /criancas/ocupacao`; aba "Crianças" com aviso de migração; cartão de ocupação e KPI de receita da Prefeitura no Painel; `dias_letivos` editável em Calendário de repasse.

**Desvios da spec original (registrados na REFINEMENT, com o corte de escopo explícito):**
- **Sem modelo `Contrato` com vigência**: um único campo `valor_dia_crianca` por escola. Se o valor mudar no meio do ano, edita-se direto — vale a partir da edição, sem histórico.
- **Rateio do Loop 1 não migrou**: `dividir` por "crianças" continua usando o campo manual `escola.criancas`, não a contagem real da coleção `Crianca`. As duas contagens podem ficar diferentes se a escola só preencher uma delas.
- **Regra de convivência com a receita manual**: em vez de o usuário precisar lembrar de apagar a receita "Contrato Prefeitura", o app ignora automaticamente as receitas `segue_calendario=1` assim que há crianças de vaga `prefeitura` cadastradas. **Risco real e testado no VERIFY**: cadastrar só 1 de 62 crianças faz a receita do ano parecer artificialmente 90% menor — por isso o aviso na aba Crianças e a instrução de migrar todas de uma vez.
- **Fórmula de proporção nos dias**: como o app não guarda o calendário letivo dia a dia, distribuí os dias letivos uniformemente pelos dias corridos do mês. Funciona bem para matrícula/saída no meio do mês; **ainda não foi conferido contra uma fatura real da Prefeitura** (fica como carry-over).

**Retro:**
- **Ajudou:** ter perguntado a fórmula ao dono antes de escrever qualquer linha de `children.js` evitou implementar (e depois refazer) a hipótese errada sobre o repasse.
- **Atrapalhou:** o primeiro teste de API do AC3 falhou não por bug de produto, mas porque duas crianças cadastradas em testes anteriores no mesmo arquivo continuavam "ativas" (sem `data_saida`) e se somaram inesperadamente — isolar em uma escola nova resolveu. De brinde, achei e corrigi uma falha de isolamento real entre arquivos de teste (nomes de banco podiam colidir).
- **Mudar no processo:** ao escrever testes de API que reusam a mesma escola em vários `test()` do mesmo arquivo, checar se um cadastro "imortal" (sem data de saída) de um teste anterior contamina a contagem do teste seguinte — vale um item na fase TEST.

**Carry-overs:**
1. `test/api/helpers.js` tinha um nome de banco que podia colidir entre arquivos de teste rodando em paralelo (`pid + Date.now()`); corrigido com bytes aleatórios, mas vale revisitar se voltar a piscar.
2. Confirmar a fórmula de proporção de dias contra uma fatura real da Prefeitura (Loop 5/indicadores é uma boa hora, ou antes se houver uma fatura em mãos).
3. Migrar o rateio do Loop 1 para usar a contagem real de `Crianca` em vez do campo manual `escola.criancas` — ou documentar de vez que são fontes independentes.
4. Sem histórico de mudança de `valor_dia_crianca` no meio do ano.
5. Ação de pagar conta e aviso de erro continuam por `prompt()`/`alert()` (carry-over do Loop 0/1, ainda não resolvido).
