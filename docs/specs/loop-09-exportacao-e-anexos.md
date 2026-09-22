# Loop 09 — Exportação para o contador e anexos

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 09 · **Tamanho:** M · **Depende de:** Loops 1 e 4 (Loop 8 para anexos sensíveis)
**Arquivos tocados:** `export.js`, `server.js`, `db.js` (Anexo), `public/app.js`

## Objetivo
Um clique gera a planilha para o contador (folha do mês, DRE, contas pagas, lançamentos, rescisões) e o termo de cálculo de rescisão em PDF. Notas, boletos e comprovantes ficam anexados à conta ou ao lançamento a que pertencem.

## Escopo
**Dentro:**
- Exportar XLSX e CSV: folha, DRE, contas pagas, lançamentos e rescisões, por período e escola
- PDF do cálculo de rescisão (simulação; **não** substitui o TRCT oficial)
- Anexar PDF/JPG/PNG a contas e lançamentos, com tamanho e tipo validados
- Baixar e apagar anexo

**Fora (explicitamente):**
- Assinatura digital
- Envio direto ao contador
- Geração do TRCT/eSocial

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Biblioteca de planilha | `exceljs`, a mesma do Kivoni | Padrão já conhecido | Proposta |
| Onde guardar anexos | GridFS no próprio Mongo | Um só backup cobre dados e arquivos | Proposta |
| Limite de anexo | 5 MB; pdf, jpg, png; conferir bytes iniciais, não só a extensão | Evita arquivo disfarçado | Proposta |

## Critérios de aceite
- [ ] AC1 — A exportação da folha de outubro tem uma linha por colaborador ativo e o total igual ao da tela *(verificar: teste `AC1` + abrir no Excel)*
- [ ] AC2 — O XLSX abre sem aviso de erro no Excel e no Numbers, com valores numéricos (não texto) *(verificar: abrir nos dois)*
- [ ] AC3 — O PDF da rescisão traz as mesmas linhas e totais da tela e o aviso de que é simulação *(verificar: teste comparando linhas + leitura do PDF)*
- [ ] AC4 — Anexo de 6 MB é recusado (413/400); arquivo `.pdf` que na verdade é executável é recusado *(verificar: teste `AC4`)*
- [ ] AC5 — Anexo aparece na conta, baixa idêntico ao enviado e some ao apagar *(verificar: hash do arquivo antes e depois)*

## Notas de design
- `export.js` recebe dados já calculados e só formata; nada de regra de negócio aqui.
- Anexo: `{ dono_tipo, dono_id, nome, tipo, tamanho, gridfs_id }`; nome do arquivo saneado.

## Configuração
`ANEXO_MAX_MB` (padrão 5).

## Tarefas
- [ ] 1. Formatação das planilhas com testes de conteúdo
- [ ] 2. PDF da rescisão
- [ ] 3. Modelo Anexo, upload validado e download
- [ ] 4. Botões de exportar e anexar nas telas
- [ ] 5. VERIFY abrindo os arquivos nos programas reais

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
