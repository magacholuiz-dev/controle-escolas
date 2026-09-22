// Erro causado por entrada inválida do usuário: a API responde com o `status` (400 por padrão), nunca 500.
export class ErroEntrada extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.name = 'ErroEntrada';
    this.status = status;
  }
}

const ROTULOS = {
  nome: 'nome', descricao: 'descrição', categoria: 'categoria', valor: 'valor', valor_mensal: 'valor mensal', data: 'data', tipo: 'tipo',
  escola_id: 'escola', salario: 'salário', beneficios: 'benefícios', data_admissao: 'data de admissão', data_desligamento: 'data de desligamento',
  mes_ferias: 'mês das férias', encargos_pct: 'encargos (%)', imposto_pct: 'impostos (%)', saldo_inicial: 'saldo inicial', criancas: 'crianças',
};
const rotulo = (campo) => ROTULOS[campo] ?? campo;

// Traduz erros do Mongoose para uma frase que a pessoa consiga agir em cima.
export function mensagemDeValidacao(e) {
  if (e.name === 'CastError') return `Valor inválido no campo "${rotulo(e.path)}".`;
  if (e.name !== 'ValidationError') return e.message;
  return Object.values(e.errors).map((x) => {
    const campo = rotulo(x.path);
    if (x.kind === 'required') return `Preencha o campo "${campo}".`;
    if (x.kind === 'min' || x.kind === 'max') return `Valor fora da faixa permitida em "${campo}".`;
    if (x.kind === 'enum') return `Valor não permitido em "${campo}".`;
    return `Valor inválido no campo "${campo}".`;
  }).join(' ');
}
