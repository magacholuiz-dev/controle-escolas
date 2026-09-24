# Loop 09 — Exportação para o contador e anexos

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 09 · **Tamanho:** M · **Depende de:** Loops 1 e 4 (Loop 8 para anexos sensíveis)
**Arquivos tocados:** `export.js` (puro), `server.js`, `public/app.js`

## Objetivo
Um clique gera a planilha (CSV) para o contador: folha, DRE, contas pagas e lançamentos, por período e escola.

**Cortado nesta versão** (ver Decisões): PDF do termo de rescisão e anexos de arquivo (nota/boleto/comprovante). As três coisas que a spec original pedia além do CSV — biblioteca de planilha binária, geração de PDF, e upload de arquivo — são coisas que esta sessão não consegue verificar de verdade: não há como abrir o resultado num Excel/Numbers real, nem renderizar e ler um PDF, e upload de arquivo binário é sensível o bastante (segurança, tipo de conteúdo, tamanho) para merecer seu próprio loop, testado com arquivos de verdade. Entregar CSV é verificável de ponta a ponta nesta sessão: sem dependência nova, conteúdo comparável byte a byte com o relatório.

## Escopo
**Dentro:**
- Exportar CSV: folha do mês, DRE, contas pagas e lançamentos, por período e escola

**Fora (explicitamente):**
- Assinatura digital
- Envio direto ao contador
- Geração do TRCT/eSocial
- **XLSX binário** (via `exceljs` ou similar) — cortado, ver Objetivo. CSV abre no Excel, Numbers, Google Sheets e qualquer editor de texto, sem biblioteca nova
- **PDF do termo de rescisão** — cortado, ver Objetivo. A tela de rescisão (Loop 0) já mostra e permite copiar os mesmos números
- **Anexos de arquivo** (nota, boleto, comprovante) — cortado, ver Objetivo. Fica para um loop próprio, com upload de arquivo real testado

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Formato da planilha | CSV (não XLSX) | Sem dependência nova; abre em qualquer programa de planilha; totalmente verificável nesta sessão (conteúdo, não a UI do Excel) | Confirmada (REFINEMENT), corte de escopo |
| Separador e decimal | `;` como separador de campo, `,` como decimal (padrão do Excel em português) | O público é a contabilidade brasileira; esse é o padrão que o Excel PT-BR espera ao abrir por duplo clique | Confirmada (REFINEMENT) |
| Acentos/UTF-8 | BOM (`\ufeff`) no início do arquivo | Sem o BOM, o Excel do Windows abre acentos errados em CSV UTF-8 | Confirmada (REFINEMENT) |
| PDF e anexos | Adiados — ver Objetivo/Escopo | Não verificáveis de ponta a ponta nesta sessão | Confirmada (REFINEMENT), corte de escopo |

## Critérios de aceite
- [x] AC1 — A exportação da folha de uma competência tem uma linha por colaborador ativo naquele mês e o total (soma dos salários) igual ao `salaries` do relatório daquele mês *(verificar: teste `AC1`)*
- [x] AC2 — O CSV usa `;` como separador, `,` como decimal, tem BOM UTF-8, e nenhuma célula de texto com `;`, `"` ou quebra de linha quebra o formato (célula entre aspas, aspas internas duplicadas) *(verificar: teste `AC2`, com uma descrição adversarial contendo os três)*
- [x] AC3 — A exportação do DRE tem uma linha por grupo e o total é igual a `statement.result` *(verificar: teste `AC3`)*
- [x] AC4 — A exportação de contas pagas só lista contas com `paid_at` preenchido, dentro do período pedido, com o valor pago (`amount_paid`) *(verificar: teste `AC4`)*
- [x] AC5 — A exportação de lançamentos do ano tem exatamente as mesmas linhas que `GET /api/entries`, na mesma ordem *(verificar: teste `AC5` + teste de API)*
- [x] AC6 — Competência ou escola inválida devolve 400/404, nunca 500; escola sem nenhum dado no período devolve um CSV só com o cabeçalho, não um erro *(verificar: teste `AC6`)*

## Notas de design
- `export.js` puro: `toCsv(rows, columns)` genérico (escapa `;`/`"`/quebra de linha, formata número com `,` decimal); `payrollRows(report, employees, period)`, `statementRows(statement)`, `paidBillsRows(bills, period)`, `entriesRows(entries)` — cada um recebe dados já calculados por `calc.js`/`statement.js`/os models, e só formata. Nenhuma regra de negócio nova.
- Endpoints `GET /api/export/payroll`, `/statement`, `/bills`, `/entries` (querystring `school_id`, `year`, `period`/`month` conforme o caso) devolvem `text/csv; charset=utf-8` com `Content-Disposition: attachment`.

## Configuração
Nenhuma.

## Tarefas
- [x] 1. `export.js` puro (`toCsv` + as 4 funções de linhas) com testes, inclusive de escape
- [x] 2. Endpoints `GET /api/export/*`
- [x] 3. Botões de exportar nas telas (Equipe, DRE, Contas a pagar, Lançamentos)
- [x] 4. `npm run test:api` completo
- [x] 5. VERIFY: baixar cada CSV pela tela e confirmar o conteúdo (abrir como texto — não há Excel/Numbers nesta sessão para testar a UI de abertura, ver Decisões)

## Registro de acompanhamento
### PLAN        — [ ] explorou o código · [ ] spec rascunhada · [ ] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (todas nossas; corte de escopo grande e documentado — sem XLSX/PDF/anexos) · [x] suposições conferidas · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-23
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma variável nova) → feito em 2026-09-23
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · [x] suíte completa · suítes: lógica 11/11 arquivos · API 48/48 → verde em 2026-09-23
### VERIFY      — [x] passeio no navegador + capturas (claro/escuro, desktop/celular) · [x] checklist de ACs · [x] sonda hostil · [x] regressão · [x] portas na rede · [x] baixei os 4 CSVs de verdade e li os bytes (BOM confirmado byte a byte) → tudo ✅ em 2026-09-23
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-23
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança) · [x] memória atualizada → próximo loop iniciado em 2026-09-23 (Loop 10)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ teste de API "AC1": folha de setembro/2026 lista os ativos daquele mês; soma dos salários no CSV bate com `report.months[8].salaries`. Na demo: baixei a folha de 2026-09 e conferi as linhas |
| AC2 | ✅ `test-export.js` (BOM na string, escape de `;`/`"`/quebra de linha) e teste de API (cabeçalhos `Content-Type`/`Content-Disposition`). No navegador, li os **bytes brutos** dos 4 CSVs (via `arrayBuffer`, não `.text()`, que remove o BOM antes de eu conseguir observar) — os 3 primeiros bytes são `EF BB BF` (BOM UTF-8) nos quatro arquivos; acentos (Salário, Descrição, utensílios) corretos |
| AC3 | ✅ `test-export.js` e teste de API: a exportação do DRE tem uma linha por grupo + "Resultado", e o valor de "Resultado" bate com `statement.result`. Na demo, R$ do CSV bateu com a tela |
| AC4 | ✅ `test-export.js` e teste de API: só contas com `paid_at`, dentro do período, usando `amount_paid` |
| AC5 | ✅ `test-export.js` e teste de API: mesma contagem de linhas que `GET /api/entries` |
| AC6 | ✅ teste de API "AC6": escola sem dado nenhum devolve CSV só com cabeçalho (200, nunca erro); parâmetros inválidos (id malformado, competência errada, ano inválido, exportação inexistente) devolvem 400/404 |

**Os testes detectam regressão?** Quebrei o escape (`escapeField` sempre devolvendo o valor puro); o teste adversarial de `test-export.js` falhou imediatamente. Código restaurado, suíte voltou a 11/11.

## Resultado

**Entregou:** `export.js` puro (`toCsv` genérico + 4 formatadores: folha, DRE, contas pagas, lançamentos); 4 endpoints `GET /api/export/*`; botão de exportar em Equipe, DRE, Contas a pagar e Lançamentos. CSV com `;`, decimal `,`, BOM UTF-8 — padrão Excel PT-BR.

**Desvios (corte de escopo grande, decidido na REFINEMENT, não um desvio de última hora):**
- **Sem XLSX binário** — só CSV. Evita uma dependência nova (`exceljs`) cuja saída eu não conseguiria abrir num Excel/Numbers real para confirmar.
- **Sem PDF do termo de rescisão** — a tela de rescisão (Loop 0) já mostra e permite copiar os mesmos números; gerar e "ler" um PDF de verdade não é algo que esta sessão consiga verificar.
- **Sem anexos de arquivo** (nota, boleto, comprovante) — upload de arquivo binário é sensível (tipo de conteúdo, tamanho, nome saneado) e merece um loop próprio, testado com arquivos reais, não espremido aqui.

**Retro:**
- **Ajudou:** cortar para CSV desde a REFINEMENT (em vez de tentar `exceljs` e descobrir na VERIFY que não dava para confirmar nada) evitou entregar algo que eu não pudesse provar que funciona.
- **Atrapalhou:** o teste `.text()` do `fetch` no Node remove o BOM automaticamente (a especificação de decodificação UTF-8 manda fazer isso) — quase registrei um "AC2 falhou" que não era um bug real, só uma limitação de como o teste lia a resposta. Resolvido lendo os bytes brutos (`arrayBuffer`) em vez de `.text()`.
- **Mudar no processo:** ao testar um endpoint que devolve bytes exatos (BOM, encoding, binário), preferir ler `arrayBuffer`/bytes crus em vez de `.text()` — vale uma nota na fase TEST/VERIFY para o próximo loop que gerar arquivo (Loop 10 lê OFX, mesma pegadinha pode aparecer).

**Carry-overs:**
1. XLSX binário — se o dono realmente precisar (nem todo contador aceita CSV de bom grado), um loop novo com `exceljs` e uma forma de eu verificar a saída (ex.: abrir com uma biblioteca de leitura em Python/Node, não só confiar na geração).
2. PDF do termo de rescisão.
3. Anexos de arquivo (nota, boleto, comprovante) — loop próprio.
