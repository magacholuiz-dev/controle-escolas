# Loop 00 — Baseline verificado e endurecimento local

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 00 · **Tamanho:** S · **Depende de:** nada (é o Loop 0)
**Arquivos tocados:** `server.js`, `db.js`, `package.json`, `test/api/*`, `scripts/backup.sh`

## Objetivo
Tudo o que já foi construído (cadastros, rateio, rescisão, painel) provado rodando de ponta a ponta contra um MongoDB de verdade, com testes de API que ficam para os próximos loops, e o app deixa de aceitar conexões da rede local. Até aqui o Mongo nunca foi ligado junto com o código: este loop fecha essa dívida antes de empilhar features.

## Escopo
**Dentro:**
- Subir o Mongo (Docker) e rodar `npm run demo`; corrigir o que quebrar
- Extrair `criarServidor()` de `server.js` para testar a API em processo
- Testes de integração com `node:test` contra o banco `controle-escolas-test` (limpo a cada suíte)
- Validação de entrada: ids inválidos, `ano`/`mes` fora da faixa e corpo mal formado devolvem 400
- Servidor escuta só em `127.0.0.1` (variável `LISTEN_HOST` para mudar)
- `npm run backup` (mongodump via Docker) e restauração documentada

**Fora (explicitamente):**
- Login e permissões (Loop 8)
- Publicar na nuvem
- Novas features de negócio

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Runner de testes de API | `node:test` nativo | Zero dependência nova, já temos Node 23 | Proposta |
| Banco dos testes | Mongo do Docker, banco `controle-escolas-test` | Sem baixar binário (mongodb-memory-server); o Docker já é requisito | Proposta |
| Bind padrão | `127.0.0.1` | Hoje qualquer aparelho da rede lê salários e CPFs | Proposta |

## Critérios de aceite
- [x] AC1 — `npm run db && npm run demo` sobe sem erro e `GET /api/relatorio?ano=2026&escola=todas` devolve 12 meses com `totais.receita > 0` *(verificar: teste `AC1` + curl)*
- [x] AC2 — Dividir R$ 1.850,00 por crianças (62 x 48) grava 2 lançamentos com o mesmo `grupo_id` somando R$ 1.850,00 *(verificar: teste `AC2`)*
- [x] AC3 — `DELETE /api/lancamentos/:id?grupo=1` remove os dois lançamentos do grupo *(verificar: teste `AC3`)*
- [x] AC4 — Colaborador com salário R$ 3.000, admissão 10/03/2023 e 3 períodos de férias gozados, rescisão em 18/09/2026 sem justa causa: `totalColaborador` = 10.866,67 e `custoEscola` = 16.153,07 *(verificar: teste `AC4` + conta à mão)*
- [x] AC5 — Efetivar a rescisão desliga o colaborador (`ativo=0`), cria lançamento avulso categoria "Rescisão" e a saída do mês sobe no relatório *(verificar: teste `AC5`)*
- [x] AC6 — Com o app no ar, `lsof -iTCP:3200 -sTCP:LISTEN` mostra `127.0.0.1` e outro aparelho da rede não conecta *(verificar: comando + celular no mesmo Wi-Fi)*
- [x] AC7 — Id malformado, `ano=abc` e JSON quebrado devolvem 400 com mensagem, nunca 500 *(verificar: teste `AC7`)*
- [x] AC8 — As 7 abas abrem sem erro no console, em tema claro/escuro e largura de celular *(verificar: passeio no navegador + capturas)*
- [x] AC9 — `npm run backup` gera um arquivo e ele restaura em um banco vazio com a mesma contagem de documentos *(verificar: comando + `countDocuments`)*
- [x] AC10 — *(adicionado na VERIFY)* A porta do Mongo (27019) também fica restrita a `127.0.0.1`: `nc -z <IP da rede> 27019` recusa e `nc -z 127.0.0.1 27019` conecta *(verificar: comando)*

## Notas de design
- `server.js`: exportar `criarServidor()` e só chamar `listen` em `if (import.meta.url === …)`; validar `Number(ano)`/`mes` e `mongoose.isValidObjectId` no início de `api()`.
- Testes: `test/api/helpers.js` sobe o servidor em porta aleatória, semeia via HTTP e limpa as coleções.
- Backup: `docker exec controle-escolas-mongo mongodump --archive --gzip > backups/AAAA-MM-DD.gz` (pasta no `.gitignore`).
- Achados do baseline que já sabemos: `escolaAlvo()` escolhe silenciosamente a 1ª escola quando o filtro é "Todas"; avaliar se a tela deve pedir a escola.

## Configuração
`LISTEN_HOST` (padrão `127.0.0.1`) em `.env.example`.

## Tarefas
- [x] 1. Ligar o Docker, `npm run db`, `npm run demo` e anotar tudo que quebrar (viram tarefas)
- [x] 2. Corrigir os bugs achados no passeio inicial
- [x] 3. Extrair `criarServidor()` e o bind configurável
- [x] 4. Validação de entrada com 400
- [x] 5. Escrever `test/api/*.test.js` para AC1 a AC7 e o script `test:api`
- [x] 6. Script e doc de backup/restauração
- [x] 7. Passeio de VERIFY completo com capturas

## Registro de acompanhamento
### PLAN        — [x] explorou o código · [x] spec rascunhada · [x] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (as 3 eram Proposta, sem dependência do dono) · [x] suposições conferidas · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-21
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (`LISTEN_HOST`) → feito em 2026-09-21
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · suítes: lógica 3/3 arquivos · API 5/5 → verde em 2026-09-21
### VERIFY      — [x] passeio no navegador + capturas · [x] checklist de ACs · [x] sonda hostil · [x] regressão · [x] números conferidos à mão → tudo ✅ em 2026-09-21
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-21
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança de ordem) · [x] memória atualizada → próximo loop iniciado em ____ (aguardando decisão de começar o Loop 1)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ `test/api/api.test.js` "AC1"; `curl /api/relatorio?ano=2026&escola=todas` na demo: 12 meses, receita R$ 1.122.000. Janeiro e julho com receita 0, fevereiro 50% |
| AC2 | ✅ teste "AC2 e AC3": R$ 1.850,00 por crianças (62 x 48) = R$ 1.042,73 + R$ 807,27; mesmo `grupo_id`. Na tela: R$ 480 = R$ 270,55 + R$ 209,45 (56,36% / 43,64%), soma exata |
| AC3 | ✅ mesmo teste: `DELETE ?grupo=1` devolve `removidos: 2` e a outra escola fica sem o lançamento |
| AC4 | ✅ teste "AC4 e AC5": totalColaborador 10.866,67 e custoEscola 16.153,07. Na tela (colaboradora da demo, admissão 01/02/2021, salário 3.200, 4 períodos de férias gozados, rescisão em 21/09/2026): conferido linha a linha à mão, total R$ 17.173,34 e custo R$ 25.693,02 |
| AC5 | ✅ mesmo teste: `ativo=0`, `data_desligamento`, lançamento avulso "Rescisão" de R$ 16.153,07; a saída de setembro sobe exatamente esse valor |
| AC6 | ✅ `lsof` mostra `node 127.0.0.1:3200`; `curl` pelo IP da rede (192.168.68.55) recusa e por localhost responde 200. Feito pelo IP da própria máquina, não por um celular: mesma prova (a interface de rede recusa) |
| AC7 | ✅ teste "AC7": 19 casos inválidos devolvem 4xx com mensagem em português; 500 nunca. Inclui JSON quebrado, ano `abc`, mês 13, corpo de 1,2 MB (413), `..` no caminho estático (sem vazar código) |
| AC8 | ✅ 7 abas sem erro no console, sem `NaN`/`undefined`, sem rolagem horizontal da página em 375 px; tema escuro e claro conferidos com capturas |
| AC9 | ✅ `npm run backup` (4 KB) e `scripts/restore.sh` num banco vazio: `calendarios=24, despesas=12, escolas=2, funcionarios=15, lancamentos=4, receitas=4` nos dois; banco de teste apagado depois |
| AC10 | ✅ antes: `nc -z 192.168.68.55 27019` conectava sem senha. Depois de `127.0.0.1:27019:27017` no compose: recusa pela rede, conecta por localhost, dados mantidos (15 colaboradores) |

**Os testes detectam regressão?** Quebrei o código de propósito duas vezes: sem a validação do ano e sem o limite de corpo. Nas duas o teste "AC7" falhou; código restaurado, 5/5.

## Resultado

**Entregou:** app provado de ponta a ponta com Mongo real; `criarServidor()` exportável; 5 testes de API (`npm run test:api`) com banco descartável por arquivo; validação de entrada com `ErroEntrada`, corpo limitado a 1 MB e erros técnicos do Mongoose traduzidos ("Preencha o campo \"descrição\"."); servidor e Mongo restritos a `127.0.0.1`; `npm run backup` e `scripts/restore.sh`.

**Desvios:**
- **AC10 não estava na spec.** O Mongo do compose estava aberto à rede local, sem senha, e só apareceu na VERIFY. Entrou no loop porque o objetivo era "não aceitar conexões da rede".
- **Erros do passeio corrigidos no loop:** (1) sem descrição, a API respondia `Path descricao is required` e o cadastro comum não mostrava nada na tela; agora a mensagem é em português e `unhandledrejection` exibe todo erro de API. (2) Abrir um cadastro com o filtro em "Todas" trocava de escola em silêncio; agora o filtro passa a mostrar a primeira escola.
- AC6 foi verificado pelo IP da própria máquina, não por um celular.

**Retro:**
- **Ajudou:** o teste de API nasceu junto com a conferência à mão dos números; a mutação provou que os testes pegam erro.
- **Atrapalhou:** o AC6 nasceu estreito (só o app). Vale, em todo loop de segurança, listar cada porta aberta da máquina, não só a do app.
- **Mudar no processo:** na fase VERIFY, incluir "listar tudo o que escuta na rede" (`lsof -iTCP -sTCP:LISTEN`) como item fixo.

**Carry-overs:**
1. `PUT`/`DELETE` com id válido que não existe respondem 200, não 404 (só o `GET /rescisao` devolve 404). Corrigir junto com o Loop 1.
2. Erros aparecem por `alert()`, funcional mas cru. Trocar por aviso na própria página quando houver tela de erro padronizada.
3. Ao visitar um cadastro o filtro fica na 1ª escola e o Painel passa a mostrar só ela até o usuário escolher "Todas" de novo (o filtro deixa isso explícito). Avaliar lembrar o filtro do Painel separado.
4. O Mongo do Kivoni (`kivoni-mongo`, porta 27018) está aberto à rede local com o mesmo padrão. **Fora deste projeto**, avisar o dono.
5. Sem cabeçalhos de segurança (CSP etc.) e sem HTTPS: entram no Loop 8.
6. A entrada `controle-escolas-demo` está em `~/dev/.claude/launch.json`, fora deste repositório. Documentar no README quando o projeto ganhar repositório próprio.
