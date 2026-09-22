# Controle Financeiro das Escolas

App local para controlar entradas, saídas, provisões e lucro de duas escolas infantis
com contrato com a Prefeitura de Curitiba (repasse só nos meses com aula).

## Rodar

Mesmo padrão do Kivoni: Mongoose + `MONGODB_URI` + MongoDB 7 no Docker.

```bash
npm install
npm run db       # sobe o MongoDB (docker compose) na porta 27019
npm start        # http://localhost:3200  (Node 23.4+)
npm run demo     # igual, mas com dados fictícios no banco controle-escolas-demo
npm test         # testa o cálculo (não precisa de banco)
npm run test:api # testa a API contra o Mongo do Docker (banco descartável)
npm run backup   # backup do banco em backups/ (DB=nome para outro banco)
```

Sem Docker, aponte para qualquer MongoDB com `MONGODB_URI` (copie `.env.example` para `.env`).
O padrão é `mongodb://127.0.0.1:27019/controle-escolas`. Os dados ficam no volume
`controle_escolas_mongo_data` do Docker; para backup use `npm run backup`.
Para restaurar: `sh scripts/restore.sh backups/ARQUIVO.gz [banco-destino]`.

O servidor escuta só em `127.0.0.1` (`LISTEN_HOST` muda isso). Não exponha na rede: ainda não há login.

## Como funciona

- **Calendário de repasse**: fator por mês e por escola (padrão: jan 0%, fev 50%, jul 0%, resto 100%).
  Receitas e despesas marcadas "segue calendário" são multiplicadas por esse fator.
- **Competência (lucro)**: receita − salários − benefícios − encargos − provisão 13º − provisão férias − despesas − impostos.
- **Caixa**: 13º sai 50% em nov e 50% em dez; o adicional de 1/3 de férias sai no mês de férias de cada funcionário.
  Impostos e demais custos saem no próprio mês. Saldo acumulado, pior mês e reserva necessária aparecem no Painel.
- **Lançamentos reais**: nos meses com lançamentos, o caixa usa o realizado no lugar da previsão.

## Premissas (ajuste com a contabilidade)

- Encargos padrão 8% (só FGTS, Simples Nacional); imposto padrão 6% da receita. Ambos editáveis em Parâmetros.
- Férias: o salário do mês já está na folha, então o custo extra é o 1/3 constitucional (+ encargos), provisionado em 1/36 do salário por mês.
- 13º e adicional de férias recebem os mesmos encargos da folha.

## Documentação

- [Processo de desenvolvimento (Loop Engineering)](docs/LOOP_PROCESS.md)
- [Roadmap e specs por loop](docs/ROADMAP.md)
- [Benchmark de mercado](docs/BENCHMARK.md)
