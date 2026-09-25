// Plain-object shapes the pure functions work on. They are structural: database documents (lean),
// API bodies and test fixtures all fit, and none of them depends on Mongoose.

export type Flag = number | boolean;
export type EnrollmentType = 'public' | 'private';
export type EntryType = 'revenue' | 'expense';
export type Iso = string; // YYYY-MM-DD
export type Period = string; // YYYY-MM

export interface SchoolParams {
  payroll_tax_pct?: number;
  tax_pct?: number;
  initial_balance?: number;
  vacation_month?: number;
  child_daily_rate?: number | null;
}

export interface EmployeeInput {
  _id?: unknown;
  name?: string;
  role?: string;
  cpf?: string;
  salary: number;
  benefits?: number;
  active?: Flag;
  hire_date?: Iso | null;
  termination_date?: Iso | null;
  vacation_month?: number | null;
  vacation_periods_taken?: number;
  fgts_balance?: number | null;
}

export interface RevenueInput { monthly_amount: number; follows_calendar?: Flag }
export interface ExpenseInput { category?: string; monthly_amount: number; follows_calendar?: Flag }

export interface EntryInput {
  date: Iso;
  type: EntryType;
  category?: string;
  description?: string;
  amount: number;
  one_off?: Flag;
}

export interface ChildInput {
  _id?: unknown;
  school_id?: unknown;
  name?: string;
  enrollment_type?: EnrollmentType;
  enrollment_date?: Iso | null;
  exit_date?: Iso | null;
  tuition_amount?: number;
  guardian_name?: string;
}

export interface BillInput {
  category: string;
  period: Period;
  amount: number;
  due_date: Iso;
  paid_at?: Iso | null;
}

export interface SeveranceReserve { turnoverPct: number }

export interface SchoolInputs {
  school: SchoolParams;
  employees: EmployeeInput[];
  revenues: RevenueInput[];
  expenses: ExpenseInput[];
  factors: number[];
  closedMonths?: boolean[];
  entries: EntryInput[];
  year: number;
  children?: ChildInput[];
  schoolDays?: (number | null | undefined)[];
  revenueDelayMonths?: number;
  severanceReserve?: SeveranceReserve | null;
}

export interface MonthActual { n: number; revenue: number; expense: number }

export interface MonthResult {
  month: number;
  factor: number;
  revenue: number;
  derivedRevenue: number;
  salaries: number;
  benefits: number;
  charges: number;
  thirteenthProvision: number;
  vacationProvision: number;
  severanceProvision: number;
  expenses: number;
  taxes: number;
  accrualCost: number;
  result: number;
  thirteenthPayout: number;
  vacationPayout: number;
  oneOffExpense: number;
  oneOffRevenue: number;
  actual: MonthActual;
  closed: boolean;
  cashIn: number;
  cashOut: number;
  balance: number;
}

export type Totals = Record<
  'revenue' | 'derivedRevenue' | 'salaries' | 'benefits' | 'charges' | 'thirteenthProvision' | 'vacationProvision' | 'severanceProvision'
  | 'expenses' | 'taxes' | 'accrualCost' | 'result' | 'cashIn' | 'cashOut',
  number
>;

export interface CategoryTotals { category: string; budgeted: number; actual: number; oneOff: number }

export interface CashFlow {
  months: MonthResult[];
  totals: Totals;
  initialBalance: number;
  finalBalance: number;
  minBalance: number;
  minBalanceMonth: number;
  reserveNeeded: number;
  margin: number;
}

export interface Report extends CashFlow { categories: CategoryTotals[] }
