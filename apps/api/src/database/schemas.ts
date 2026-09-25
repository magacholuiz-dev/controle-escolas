// Mongoose schemas for the 14 collections. Same model names (so Mongoose derives the same
// collection names), same fields and same indexes as the legacy app: the database is shared, so
// nothing has to be migrated and rolling back is just switching the proxy back.
import { Schema, type HydratedDocument, type Model, type SchemaDefinition, type Types } from 'mongoose';

type Oid = Types.ObjectId;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-\d{2}$/;

// Returns `id` (string) instead of `_id`/`__v`, so the JSON API and the front end stay simple.
const schemaOptions = {
  versionKey: false,
  toJSON: { virtuals: true, transform: (_: unknown, o: Record<string, unknown>) => { delete o._id; return o; } },
};
const schoolIdField = { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true };
const num = (defaultValue = 0) => ({ type: Number, default: defaultValue });

export interface SchoolDoc {
  name: string; payroll_tax_pct: number; tax_pct: number; initial_balance: number; vacation_month: number; children_count: number;
  capacity: number | null; child_daily_rate: number | null; tuition_due_day: number; turnover_pct: number;
}
export interface EmployeeDoc {
  school_id: Oid; name: string; role: string; salary: number; benefits: number; vacation_month: number | null; active: number; cpf: string;
  hire_date: string | null; termination_date: string | null; vacation_periods_taken: number; fgts_balance: number | null;
}
export interface RevenueDoc { school_id: Oid; description: string; monthly_amount: number; follows_calendar: number }
export interface ExpenseDoc {
  school_id: Oid; description: string; category: string; monthly_amount: number; follows_calendar: number; due_day: number | null;
  group_id: string | null; total_amount: number | null; split_pct: number | null;
}
export interface SupplierDoc { name: string; tax_id: string; contact: string }
export interface BillDoc {
  school_id: Oid; supplier_id: Oid | null; expense_id: Oid | null; description: string; category: string; period: string; due_date: string;
  amount: number; paid_at: string | null; amount_paid: number | null; payment_method: string; group_id: string | null;
  total_amount: number | null; split_pct: number | null; installment_group_id: string | null; installment_no: number | null; installment_count: number | null;
}
export interface ChildDoc {
  school_id: Oid; name: string; birth_date: string | null; classroom: string; guardian_name: string; guardian_phone: string;
  enrollment_type: 'public' | 'private'; tuition_amount: number; enrollment_date: string | null; exit_date: string | null;
}
export interface TuitionDoc {
  school_id: Oid; child_id: Oid; period: string; base_amount: number; discount: number; due_date: string; paid_at: string | null;
  amount_paid: number | null; payment_method: string;
}
export interface EntryDoc {
  school_id: Oid; date: string; type: 'revenue' | 'expense'; category: string; description: string; amount: number; one_off: number;
  bill_id: Oid | null; tuition_id: Oid | null; group_id: string | null; total_amount: number | null; split_pct: number | null;
}
export interface CalendarDoc { school_id: Oid; year: number; month: number; factor: number; closed: boolean; school_days: number | null }
export interface BankTransactionDoc {
  school_id: Oid; fitid: string; date: string; amount: number; name: string; fingerprint: string; suggested_kind: 'bill' | 'tuition' | null;
  suggested_id: Oid | null; reconciled: boolean; entry_id: Oid | null;
}
export interface ScenarioDoc { school_id: Oid; name: string; adjustments: unknown }
export interface UserDoc { email: string; password_hash: string; role: 'owner' | 'director'; school_ids: Oid[]; failed_attempts: number; locked_until: string | null }
export interface SessionDoc { token: string; user_id: Oid; expires_at: Date }
export interface AuditLogDoc {
  user_email: string; action: string; entity: string; entity_id: Oid | null; school_id: Oid | null; before: unknown; after: unknown; at: Date;
}

const make = <T>(definition: SchemaDefinition, collection: string, options: object = schemaOptions): Schema<T> =>
  new Schema<T>(definition as never, { ...options, collection } as never);

export const schoolSchema = make<SchoolDoc>({
  name: { type: String, required: true },
  payroll_tax_pct: num(8),
  tax_pct: num(6),
  initial_balance: num(0),
  vacation_month: { type: Number, default: 1, min: 1, max: 12 },
  children_count: num(0), // enrollment, used for proportional splitting
  capacity: { type: Number, default: null, min: 0 }, // total slots, for occupancy
  child_daily_rate: { type: Number, default: null, min: 0 }, // amount per public-slot child, per school day
  tuition_due_day: { type: Number, default: 10, min: 1, max: 28 },
  turnover_pct: { type: Number, default: 0, min: 0, max: 100 }, // yearly staff turnover; 0 = severance reserve off
}, 'schools');

export const employeeSchema = make<EmployeeDoc>({
  school_id: schoolIdField,
  name: { type: String, required: true },
  role: { type: String, default: '' },
  salary: num(0),
  benefits: num(0),
  vacation_month: { type: Number, default: null, min: 1, max: 12 },
  active: { type: Number, default: 1 },
  cpf: { type: String, default: '' },
  hire_date: { type: String, default: null, match: DATE },
  termination_date: { type: String, default: null, match: DATE },
  vacation_periods_taken: num(0),
  fgts_balance: { type: Number, default: null },
}, 'employees');

export const revenueSchema = make<RevenueDoc>({
  school_id: schoolIdField,
  description: { type: String, required: true },
  monthly_amount: num(0),
  follows_calendar: { type: Number, default: 1 },
}, 'revenues');

export const expenseSchema = make<ExpenseDoc>({
  school_id: schoolIdField,
  description: { type: String, required: true },
  category: { type: String, default: 'Outros' },
  monthly_amount: num(0),
  follows_calendar: { type: Number, default: 0 },
  due_day: { type: Number, default: null, min: 1, max: 28 }, // used when generating the month's bills
  group_id: { type: String, default: null, index: true },
  total_amount: { type: Number, default: null },
  split_pct: { type: Number, default: null },
}, 'expenses');

export const supplierSchema = make<SupplierDoc>({
  name: { type: String, required: true },
  tax_id: { type: String, default: '' },
  contact: { type: String, default: '' },
}, 'suppliers');

export const billSchema = make<BillDoc>({
  school_id: schoolIdField,
  supplier_id: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  expense_id: { type: Schema.Types.ObjectId, ref: 'Expense', default: null }, // source, when generated from a recurring expense
  description: { type: String, required: true },
  category: { type: String, default: 'Outros' },
  period: { type: String, required: true, match: PERIOD },
  due_date: { type: String, required: true, match: DATE },
  amount: { type: Number, required: true, min: [0.01, 'o valor deve ser maior que zero'] },
  paid_at: { type: String, default: null, match: DATE },
  amount_paid: { type: Number, default: null },
  payment_method: { type: String, default: '' },
  group_id: { type: String, default: null, index: true },
  total_amount: { type: Number, default: null },
  split_pct: { type: Number, default: null },
  installment_group_id: { type: String, default: null, index: true }, // one per installment purchase
  installment_no: { type: Number, default: null },
  installment_count: { type: Number, default: null },
}, 'bills');
billSchema.index({ expense_id: 1, period: 1 }, { unique: true, partialFilterExpression: { expense_id: { $type: 'objectId' } } });

export const childSchema = make<ChildDoc>({
  school_id: schoolIdField,
  name: { type: String, required: true },
  birth_date: { type: String, default: null, match: DATE },
  classroom: { type: String, default: '' },
  guardian_name: { type: String, default: '' },
  guardian_phone: { type: String, default: '' },
  enrollment_type: { type: String, enum: ['public', 'private'], default: 'public' },
  tuition_amount: { type: Number, default: 0 },
  enrollment_date: { type: String, default: null, match: DATE },
  exit_date: { type: String, default: null, match: DATE },
}, 'children');

export const tuitionSchema = make<TuitionDoc>({
  school_id: schoolIdField,
  child_id: { type: Schema.Types.ObjectId, ref: 'Child', required: true, index: true },
  period: { type: String, required: true, match: PERIOD },
  base_amount: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0 },
  due_date: { type: String, required: true, match: DATE },
  paid_at: { type: String, default: null, match: DATE },
  amount_paid: { type: Number, default: null },
  payment_method: { type: String, default: '' },
}, 'tuitions');
tuitionSchema.index({ child_id: 1, period: 1 }, { unique: true });

export const entrySchema = make<EntryDoc>({
  school_id: schoolIdField,
  date: { type: String, required: true, match: DATE },
  type: { type: String, enum: ['revenue', 'expense'], required: true },
  category: { type: String, default: 'Outros' },
  description: { type: String, default: '' },
  amount: num(0),
  one_off: { type: Number, default: 0 }, // 1 = outside the budget: adds to the plan (one-time purchase, severance)
  bill_id: { type: Schema.Types.ObjectId, ref: 'Bill', default: null, index: true },
  tuition_id: { type: Schema.Types.ObjectId, ref: 'Tuition', default: null, index: true },
  group_id: { type: String, default: null, index: true },
  total_amount: { type: Number, default: null },
  split_pct: { type: Number, default: null },
}, 'entries');

export const calendarSchema = make<CalendarDoc>({
  school_id: schoolIdField,
  year: { type: Number, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  factor: { type: Number, required: true, min: 0, max: 1 },
  closed: { type: Boolean, default: false }, // closed month: cash flow uses only the actual entries
  school_days: { type: Number, default: null, min: 0, max: 31 },
}, 'calendars');
calendarSchema.index({ school_id: 1, year: 1, month: 1 }, { unique: true });

export const bankTransactionSchema = make<BankTransactionDoc>({
  school_id: schoolIdField,
  fitid: { type: String, default: '' },
  date: { type: String, required: true, match: DATE },
  amount: { type: Number, required: true },
  name: { type: String, default: '' },
  fingerprint: { type: String, required: true, unique: true, index: true },
  suggested_kind: { type: String, enum: ['bill', 'tuition', null], default: null },
  suggested_id: { type: Schema.Types.ObjectId, default: null },
  reconciled: { type: Boolean, default: false },
  entry_id: { type: Schema.Types.ObjectId, ref: 'Entry', default: null },
}, 'banktransactions');

export const scenarioSchema = make<ScenarioDoc>({
  school_id: schoolIdField,
  name: { type: String, required: true },
  adjustments: { type: Schema.Types.Mixed, default: [] }, // free-form list, validated by the domain, never touches other collections
}, 'scenarios');

export const userSchema = make<UserDoc>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['owner', 'director'], required: true },
  school_ids: [{ type: Schema.Types.ObjectId, ref: 'School' }], // ignored for role = owner
  failed_attempts: { type: Number, default: 0 },
  locked_until: { type: String, default: null },
}, 'users', {
  ...schemaOptions,
  toJSON: { virtuals: true, transform: (_: unknown, o: Record<string, unknown>) => { delete o._id; delete o.password_hash; return o; } },
});

export const sessionSchema = make<SessionDoc>({
  token: { type: String, required: true, unique: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expires_at: { type: Date, required: true },
}, 'sessions');

export const auditLogSchema = make<AuditLogDoc>({
  user_email: { type: String, required: true },
  action: { type: String, required: true },
  entity: { type: String, default: '' },
  entity_id: { type: Schema.Types.ObjectId, default: null },
  school_id: { type: Schema.Types.ObjectId, default: null },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  at: { type: Date, default: Date.now },
}, 'auditlogs');

// Model name → schema. The names are the same ones the legacy app registered.
export const MODELS = {
  School: schoolSchema, Employee: employeeSchema, Revenue: revenueSchema, Expense: expenseSchema, Supplier: supplierSchema,
  Bill: billSchema, Child: childSchema, Tuition: tuitionSchema, Entry: entrySchema, Calendar: calendarSchema,
  BankTransaction: bankTransactionSchema, Scenario: scenarioSchema, User: userSchema, Session: sessionSchema, AuditLog: auditLogSchema,
} as const;

export type ModelName = keyof typeof MODELS;
export type M<T> = Model<T>;
export type Doc<T> = HydratedDocument<T>;

// City hall payment: only paid when the children actually attend school.
export const DEFAULT_FACTOR = [0, 0.5, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1];
// Default school days per month (a guess; the school adjusts it in the Children tab).
export const DEFAULT_SCHOOL_DAYS = [0, 10, 20, 20, 20, 20, 0, 20, 20, 20, 20, 20];
