# Benchmark: gestão financeira para escolas

Fontes consultadas em set/2026: páginas de produto e blogs de Nibo, Proesc, Unimestre, Delta SGE, Sponte e Gennera,
e calculadoras de rescisão (InfinitePay, Legale, Guia CLT). Nenhum desses sistemas foi testado por dentro;
o que segue vem do que eles divulgam.

## O que o mercado oferece

| Recurso | Quem divulga | Neste app |
|---|---|---|
| Contas a pagar por tipo de despesa com **rateio por centro de custo** | Nibo, Proesc, Edukante | Feito (divisão entre escolas: igual, por crianças, manual) |
| Relatórios por plano de contas e centro de custo, DRE por unidade | Sponte, Gennera, Nibo | Parcial (DRE por escola e por categoria) |
| Fluxo de caixa com previsão | Sponte, Gennera | Feito (competência e caixa, com meses sem repasse) |
| Previsto x realizado | Nibo, Unimestre | Feito (por categoria) |
| Cobrança automática, boleto, remessa/retorno bancário | Todos | Não |
| Controle de inadimplência por aluno | Sponte (diz reduzir mais de 30%), Gennera | Não |
| Indicadores de matrícula, inadimplência e retenção | Gennera | Não |

## Rescisão (CLT)

Regras usadas em `rescisao.js`, conferidas com as calculadoras acima e com a Lei 12.506/2011:

- Sem justa causa: saldo de salário, aviso (30 dias + 3 por ano, máx. 90), 13º e férias proporcionais + 1/3, férias vencidas + 1/3, multa de 40% do FGTS, saque de 100%.
- Acordo (art. 484-A): aviso pela metade, multa de 20%, saque de 80%.
- Pedido de demissão: sem aviso indenizado (desconto se não cumprir), sem multa, sem saque.
- Justa causa: só saldo de salário e férias vencidas.

Limites: valores brutos (sem INSS/IRRF), sem médias de horas extras/adicionais, FGTS estimado quando não informado.
Sempre confirmar com a contabilidade antes de pagar.

## O que ainda vale adicionar (por prioridade)

1. **Contas a pagar com vencimento e baixa**: hoje só existe o valor do mês. Vencimento, pago/pendente e fornecedor evitam esquecer conta.
2. **Mensalidades por criança e inadimplência**: cadastrar as crianças e o valor do contrato por criança/dia deixa a receita da Prefeitura sair da matrícula, e mostra quem atrasou nas mensalidades particulares.
3. **Indicadores**: custo por criança, folha sobre receita, ponto de equilíbrio por escola, comparativo Novo Mundo x CIC.
4. **Cenários**: "e se a Prefeitura atrasar 2 meses?", "e se perdermos 10 crianças?".
5. **Alertas**: férias vencendo (risco de pagar em dobro), conta de luz acima da média, caixa negativo à frente.
6. **Reserva de rescisão**: provisionar todo mês uma parte para a multa do FGTS e o aviso de quem pode sair. Sugestão nossa, não vimos nos concorrentes.
7. **Exportar para o contador** (Excel/PDF) e anexar notas e boletos.
8. **Usuários e permissões**, para a direção e a contabilidade acessarem sem editar tudo.
9. **Conciliação bancária** (importar extrato OFX).
