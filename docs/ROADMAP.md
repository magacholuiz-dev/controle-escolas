# Roadmap

Cada loop segue o [processo](./LOOP_PROCESS.md) e tem uma spec em [`specs/`](./specs/). O Loop 0 está **Done**; os demais estão em **Draft**:
o PLAN existe, a REFINEMENT acontece quando o loop for o próximo (para não refinar contra um código que ainda vai mudar).

## Loops

| # | Loop | Tam. | Depende de | O que entrega | Do benchmark | Status |
|---|---|---|---|---|---|---|
| 0 | [Baseline verificado e endurecimento local](./specs/loop-00-baseline.md) | S | n/a | Tudo o que existe provado com Mongo real, testes de API, app e Mongo só no `127.0.0.1`, backup | n/a (dívida técnica) | **Done** |
| 1 | [Contas a pagar](./specs/loop-01-contas-a-pagar.md) | M | 0 | Vencimento, baixa, fornecedores, cartão de vencimentos | Nibo, Proesc | Draft |
| 2 | [Crianças, turmas e receita derivada](./specs/loop-02-criancas-e-receita.md) | L | 0 | Receita da Prefeitura vinda da matrícula e dos dias letivos | Sponte, Gennera | Draft |
| 3 | [Mensalidades e inadimplência](./specs/loop-03-mensalidades-inadimplencia.md) | M | 2 | Mensalidades, baixa, faixas de atraso, devedores | Sponte, Gennera | Draft |
| 4 | [Plano de contas, centros de custo e DRE](./specs/loop-04-dre-centros-de-custo.md) | M | 1 | DRE por escola e consolidado, previsto x realizado | Nibo, Sponte | Draft |
| 5 | [Indicadores e comparativo](./specs/loop-05-indicadores.md) | S | 2, 3, 4 | Custo por criança, ponto de equilíbrio, Novo Mundo x CIC | Gennera | Draft |
| 6 | [Cenários](./specs/loop-06-cenarios.md) | M | 0 | "E se a Prefeitura atrasar?", perda de crianças, reajuste | nosso (ver BENCHMARK §prioridade 4) | Draft |
| 7 | [Alertas e reserva de rescisão](./specs/loop-07-alertas-e-reserva.md) | M | 1, 3 | Central de alertas, provisão mensal de rescisão | nosso | Draft |
| 8 | [Usuários, permissões e auditoria](./specs/loop-08-usuarios-permissoes.md) | L | 0 | Login, papéis por escola, campos sensíveis mascarados, log | mercado em geral | Draft |
| 9 | [Exportação para o contador e anexos](./specs/loop-09-exportacao-e-anexos.md) | M | 1, 4 | XLSX/CSV/PDF, anexos de nota e comprovante | Nibo, Unimestre | Draft |
| 10 | [Conciliação bancária (OFX)](./specs/loop-10-conciliacao-bancaria.md) | M | 1, 3 | Importar extrato, sugerir e confirmar baixas | Nibo, Proesc | Draft |

Tamanhos: **S** ≈ 1–2 dias · **M** ≈ 3–5 dias · **L** ≈ 1–2 semanas (uma pessoa, com testes e VERIFY).

## Ordem recomendada e por quê

```
0 ──► 1 ──► 4 ──┐
│                ├──► 5 ──► 7 ──► 9 ──► 10
└──► 2 ──► 3 ───┘
│
├──► 6      (pode entrar em qualquer ponto depois do 0)
└──► 8      (sobe de prioridade se o app for para a nuvem)
```

1. **Loop 0 primeiro:** o código atual nunca rodou junto com um Mongo real. Empilhar features em cima disso é dívida.
2. **Contas a pagar (1) antes de crianças (2):** dá valor imediato (nada vence sem aviso) e é a parte que já sofre com os meses sem repasse.
3. **Crianças (2) depende de uma resposta do dono** sobre como a Prefeitura calcula o repasse. Perguntar agora, enquanto o Loop 0 e o 1 andam.
4. **Loop 8 é um portão, não uma feature:** o app guarda salário, CPF e rescisão. Enquanto rodar só no computador local, pode esperar. No dia em que for para a nuvem ou for aberto a outra pessoa, ele passa na frente de todos.

## Estacionado (sem loop até haver decisão)

| Item | Por que espera |
|---|---|
| Cobrança bancária: boleto, Pix cobrança, remessa/retorno CNAB | Depende de qual banco ou PSP as escolas usam e do custo por boleto |
| Envio de cobrança e alertas por WhatsApp/e-mail | Depende de provedor e de consentimento dos responsáveis (LGPD) |
| Autenticação em dois fatores | Vem depois do Loop 8 |
| eSocial/TRCT oficial | É trabalho da contabilidade; o app só simula |

## Decisões abertas para o dono

Sem estas, os loops marcados não chegam a `Ready`:

| # | Pergunta | Bloqueia |
|---|---|---|
| 1 | Como a Prefeitura de Curitiba calcula o repasse: valor por criança e por dia letivo, valor mensal por vaga, ou outro? Existe teto de vagas? (o texto do contrato resolve) | Loop 2 (e 5) |
| 2 | Entrada e saída de criança no meio do mês: o repasse é proporcional aos dias? | Loop 2 |
| 3 | O app vai rodar só neste computador ou na nuvem? Quem vai usar: só você, as diretoras, o contador? | Loop 8 (e a ordem de tudo) |
| 4 | Rotatividade de pessoal por ano (um número aproximado serve) | Loop 7 |
| 5 | As escolas usam qual banco? Cobram mensalidade particular por boleto, Pix ou dinheiro? | Loops 3 e 10, e a cobrança estacionada |

## Definition of Done global

- Spec `Done` com Resultado, Registro de verificação e retro.
- `npm test` e `npm run test:api` verdes, com as contagens registradas na spec.
- Passeio no navegador feito em tema claro, escuro e largura de celular.
- Ao menos um número da tela conferido à mão contra uma conta feita fora do app.
- `README.md` e `BENCHMARK.md` (coluna "Neste app") atualizados.

## Carry-overs

Do Loop 0 (detalhes na spec):

| # | Carry-over | Entra em |
|---|---|---|
| 1 | `PUT`/`DELETE` com id inexistente respondem 200 em vez de 404 | Loop 1 |
| 2 | Erros por `alert()`; trocar por aviso na página | Loop 1 (junto com a tela de contas) |
| 3 | Filtro de escola do Painel se mistura com o dos cadastros | Loop 5 |
| 4 | Mongo do **Kivoni** (porta 27018) aberto à rede local | Fora do projeto: avisar o dono |
| 5 | Sem CSP/HTTPS | Loop 8 |
| 6 | Entrada do `launch.json` fora do repositório | Quando houver repositório próprio |

## Changelog

| Data | Mudança |
|---|---|
| 2026-09-21 | **Loop 0 Done**: Mongo real verificado, 5 testes de API, validação de entrada, servidor e Mongo restritos a 127.0.0.1, backup/restauração. Adicionado AC10 (Mongo exposto à rede, achado na VERIFY) |
| 2026-09-21 | Roadmap criado a partir do benchmark (`BENCHMARK.md`): 11 loops (0 a 10) em Draft |
