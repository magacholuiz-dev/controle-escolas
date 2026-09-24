import mongoose from 'mongoose';

const { Schema } = mongoose;
export const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27019/controle-escolas';

// Returns `id` (string) instead of `_id`/`__v`, so the JSON API and the front end stay simple.
const schemaOptions = {
  versionKey: false,
  toJSON: { virtuals: true, transform: (_, o) => { delete o._id; return o; } },
};
const schoolIdField = { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true };
const num = (defaultValue = 0) => ({ type: Number, default: defaultValue });

export const School = mongoose.model('School', new Schema({
  name: { type: String, required: true },
  payroll_tax_pct: num(8),
  tax_pct: num(6),
  initial_balance: num(0),
  vacation_month: { type: Number, default: 1, min: 1, max: 12 },
  children_count: num(0), // enrollment, used for proportional splitting (manual field, see Loop 2 carry-over)
  capacity: { type: Number, default: null, min: 0 }, // total slots, for occupancy
  child_daily_rate: { type: Number, default: null, min: 0 }, // amount per public-slot child, per school day
  tuition_due_day: { type: Number, default: 10, min: 1, max: 28 },
  turnover_pct: { type: Number, default: 0, min: 0, max: 100 }, // yearly staff turnover; 0 = severance reserve off
}, schemaOptions));

export const Employee = mongoose.model('Employee', new Schema({
  school_id: schoolIdField,
  name: { type: String, required: true },
  role: { type: String, default: '' },
  salary: num(0),
  benefits: num(0),
  vacation_month: { type: Number, default: null, min: 1, max: 12 },
  active: { type: Number, default: 1 },
  cpf: { type: String, default: '' },
  hire_date: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  termination_date: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  vacation_periods_taken: num(0),
  fgts_balance: { type: Number, default: null },
}, schemaOptions));

export const Revenue = mongoose.model('Revenue', new Schema({
  school_id: schoolIdField,
  description: { type: String, required: true },
  monthly_amount: num(0),
  follows_calendar: { type: Number, default: 1 },
}, schemaOptions));

export const Expense = mongoose.model('Expense', new Schema({
  school_id: schoolIdField,
  description: { type: String, required: true },
  category: { type: String, default: 'Outros' },
  monthly_amount: num(0),
  follows_calendar: { type: Number, default: 0 },
  due_day: { type: Number, default: null, min: 1, max: 28 }, // used when generating the month's bills
  group_id: { type: String, default: null, index: true },
  total_amount: { type: Number, default: null },
  split_pct: { type: Number, default: null },
}, schemaOptions));

export const Supplier = mongoose.model('Supplier', new Schema({
  name: { type: String, required: true },
  tax_id: { type: String, default: '' },
  contact: { type: String, default: '' },
}, schemaOptions));

export const Bill = mongoose.model('Bill', new Schema({
  school_id: schoolIdField,
  supplier_id: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  expense_id: { type: Schema.Types.ObjectId, ref: 'Expense', default: null }, // source, when generated from a recurring expense
  description: { type: String, required: true },
  category: { type: String, default: 'Outros' },
  period: { type: String, required: true, match: /^\d{4}-\d{2}$/ }, // YYYY-MM
  due_date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  amount: { type: Number, required: true, min: [0.01, 'o valor deve ser maior que zero'] },
  paid_at: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  amount_paid: { type: Number, default: null },
  payment_method: { type: String, default: '' },
  group_id: { type: String, default: null, index: true },
  total_amount: { type: Number, default: null },
  split_pct: { type: Number, default: null },
}, schemaOptions));
Bill.schema.index({ expense_id: 1, period: 1 }, { unique: true, partialFilterExpression: { expense_id: { $type: 'objectId' } } });

export const Child = mongoose.model('Child', new Schema({
  school_id: schoolIdField,
  name: { type: String, required: true },
  birth_date: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  classroom: { type: String, default: '' },
  guardian_name: { type: String, default: '' },
  guardian_phone: { type: String, default: '' },
  enrollment_type: { type: String, enum: ['public', 'private'], default: 'public' },
  tuition_amount: { type: Number, default: 0 }, // only relevant when enrollment_type = private (used from Loop 3 on)
  enrollment_date: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  exit_date: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
}, schemaOptions));

export const Tuition = mongoose.model('Tuition', new Schema({
  school_id: schoolIdField,
  child_id: { type: Schema.Types.ObjectId, ref: 'Child', required: true, index: true },
  period: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  base_amount: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0 },
  due_date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  paid_at: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  amount_paid: { type: Number, default: null },
  payment_method: { type: String, default: '' },
}, schemaOptions));
Tuition.schema.index({ child_id: 1, period: 1 }, { unique: true });

export const Entry = mongoose.model('Entry', new Schema({
  school_id: schoolIdField,
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
  type: { type: String, enum: ['revenue', 'expense'], required: true },
  category: { type: String, default: 'Outros' },
  description: { type: String, default: '' },
  amount: num(0),
  one_off: { type: Number, default: 0 }, // 1 = outside the budget: adds to the plan (e.g. one-time purchase, severance)
  bill_id: { type: Schema.Types.ObjectId, ref: 'Bill', default: null, index: true }, // set when born from a bill payment
  tuition_id: { type: Schema.Types.ObjectId, ref: 'Tuition', default: null, index: true }, // same, tuition payment
  group_id: { type: String, default: null, index: true },
  total_amount: { type: Number, default: null },
  split_pct: { type: Number, default: null },
}, schemaOptions));

const calendarSchema = new Schema({
  school_id: schoolIdField,
  year: { type: Number, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  factor: { type: Number, required: true, min: 0, max: 1 },
  closed: { type: Boolean, default: false }, // closed month: cash flow uses only the actual entries
  school_days: { type: Number, default: null, min: 0, max: 31 }, // only used for the children's derived revenue (Loop 2); doesn't affect `factor`
}, schemaOptions);
calendarSchema.index({ school_id: 1, year: 1, month: 1 }, { unique: true });
export const Calendar = mongoose.model('Calendar', calendarSchema);

// City hall payment: only paid when the children actually attend school.
export const DEFAULT_FACTOR = [0, 0.5, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1];

// Default school days per month (a reasonable guess; the school adjusts it in the Children tab).
// Months with no city-hall payment (see DEFAULT_FACTOR) also have few or no school days.
export const DEFAULT_SCHOOL_DAYS = [0, 10, 20, 20, 20, 20, 0, 20, 20, 20, 20, 20];

export const BankTransaction = mongoose.model('BankTransaction', new Schema({
  school_id: schoolIdField,
  fitid: { type: String, default: '' },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  amount: { type: Number, required: true },
  name: { type: String, default: '' },
  fingerprint: { type: String, required: true, unique: true, index: true },
  suggested_kind: { type: String, enum: ['bill', 'tuition', null], default: null },
  suggested_id: { type: Schema.Types.ObjectId, default: null },
  reconciled: { type: Boolean, default: false },
  entry_id: { type: Schema.Types.ObjectId, ref: 'Entry', default: null },
}, schemaOptions));

export const Scenario = mongoose.model('Scenario', new Schema({
  school_id: schoolIdField,
  name: { type: String, required: true },
  adjustments: { type: Schema.Types.Mixed, default: [] }, // free-form list, validated by scenarios.js, never touches other collections
}, schemaOptions));

export async function ensureCalendar(schoolId, year) {
  await Calendar.bulkWrite(DEFAULT_FACTOR.map((factor, i) => ({
    updateOne: {
      filter: { school_id: schoolId, year, month: i + 1 },
      update: { $setOnInsert: { factor, school_days: DEFAULT_SCHOOL_DAYS[i] } },
      upsert: true,
    },
  })));
}

export async function connect(uri = MONGODB_URI) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  if ((await School.countDocuments()) === 0) await School.create([{ name: 'Novo Mundo' }, { name: 'CIC' }]);
  return mongoose.connection;
}
