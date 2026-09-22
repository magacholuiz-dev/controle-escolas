import mongoose from 'mongoose';

const { Schema } = mongoose;
export const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27019/controle-escolas';

// Devolve `id` (string) em vez de `_id`/`__v`, para a API JSON e o front continuarem simples.
const opcoes = {
  versionKey: false,
  toJSON: { virtuals: true, transform: (_, o) => { delete o._id; return o; } },
};
const escolaId = { type: Schema.Types.ObjectId, ref: 'Escola', required: true, index: true };
const num = (padrao = 0) => ({ type: Number, default: padrao });

export const Escola = mongoose.model('Escola', new Schema({
  nome: { type: String, required: true },
  encargos_pct: num(8),
  imposto_pct: num(6),
  saldo_inicial: num(0),
  mes_ferias: { type: Number, default: 1, min: 1, max: 12 },
  criancas: num(0), // matrículas, usado no rateio proporcional
}, opcoes));

export const Funcionario = mongoose.model('Funcionario', new Schema({
  escola_id: escolaId,
  nome: { type: String, required: true },
  cargo: { type: String, default: '' },
  salario: num(0),
  beneficios: num(0),
  mes_ferias: { type: Number, default: null, min: 1, max: 12 },
  ativo: { type: Number, default: 1 },
  cpf: { type: String, default: '' },
  data_admissao: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  data_desligamento: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  ferias_periodos_gozados: num(0),
  fgts_saldo: { type: Number, default: null },
}, opcoes));

export const Receita = mongoose.model('Receita', new Schema({
  escola_id: escolaId,
  descricao: { type: String, required: true },
  valor_mensal: num(0),
  segue_calendario: { type: Number, default: 1 },
}, opcoes));

export const Despesa = mongoose.model('Despesa', new Schema({
  escola_id: escolaId,
  descricao: { type: String, required: true },
  categoria: { type: String, default: 'Outros' },
  valor_mensal: num(0),
  segue_calendario: { type: Number, default: 0 },
  grupo_id: { type: String, default: null, index: true },
  valor_total: { type: Number, default: null },
  rateio_pct: { type: Number, default: null },
}, opcoes));

export const Lancamento = mongoose.model('Lancamento', new Schema({
  escola_id: escolaId,
  data: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
  tipo: { type: String, enum: ['receita', 'despesa'], required: true },
  categoria: { type: String, default: 'Outros' },
  descricao: { type: String, default: '' },
  valor: num(0),
  avulso: { type: Number, default: 0 }, // 1 = fora do orçamento: soma ao previsto (ex.: compra pontual, rescisão)
  grupo_id: { type: String, default: null, index: true },
  valor_total: { type: Number, default: null },
  rateio_pct: { type: Number, default: null },
}, opcoes));

const calendarioSchema = new Schema({
  escola_id: escolaId,
  ano: { type: Number, required: true },
  mes: { type: Number, required: true, min: 1, max: 12 },
  fator: { type: Number, required: true, min: 0, max: 1 },
  fechado: { type: Boolean, default: false }, // mês fechado: o caixa usa só o realizado
}, opcoes);
calendarioSchema.index({ escola_id: 1, ano: 1, mes: 1 }, { unique: true });
export const Calendario = mongoose.model('Calendario', calendarioSchema);

// Repasse da prefeitura: só paga quando as crianças vão à escola.
export const FATOR_PADRAO = [0, 0.5, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1];

export async function garantirCalendario(escolaId, ano) {
  await Calendario.bulkWrite(FATOR_PADRAO.map((fator, i) => ({
    updateOne: {
      filter: { escola_id: escolaId, ano, mes: i + 1 },
      update: { $setOnInsert: { fator } },
      upsert: true,
    },
  })));
}

export async function conectar(uri = MONGODB_URI) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  if ((await Escola.countDocuments()) === 0) await Escola.create([{ nome: 'Novo Mundo' }, { nome: 'CIC' }]);
  return mongoose.connection;
}
