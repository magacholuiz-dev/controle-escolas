// The HTTP contract, as types. The API returns exactly these shapes (proved by the contract suites
// in /contract); the web client is typed against them, so a change here breaks the build of
// whichever side falls out of step.
import type { Alert, Metrics, MonthResult, Report, Statement, SeveranceResult } from '@controle-escolas/domain';

export type { Alert, Metrics, MonthResult, Report, Statement, SeveranceResult };

export type Role = 'owner' | 'director';
export interface SessionUser { id: string; email: string; role: Role; school_ids: string[] }

interface Row { id: string }
interface SchoolScoped extends Row { school_id: string }

export interface School extends Row {
  name: string; payroll_tax_pct: number; tax_pct: number; initial_balance: number; vacation_month: number; children_count: number;
  capacity: number | null; child_daily_rate: number | null; tuition_due_day: number; turnover_pct: number;
}
export interface Employee extends SchoolScoped {
  name: string; role: string; salary: number | null; benefits: number; vacation_month: number | null; active: number; cpf: string;
  hire_date: string | null; termination_date: string | null; vacation_periods_taken: number; fgts_balance: number | null;
}
export interface Revenue extends SchoolScoped { description: string; monthly_amount: number; follows_calendar: number }
export interface Expense extends SchoolScoped {
  description: string; category: string; monthly_amount: number; follows_calendar: number; due_day: number | null;
  group_id: string | null; total_amount: number | null; split_pct: number | null;
}
export interface Supplier extends Row { name: string; tax_id: string; contact: string }
export type BillStatus = 'pending' | 'overdue' | 'paid';
export interface Bill extends SchoolScoped {
  supplier_id: string | null; description: string; category: string; period: string; due_date: string; amount: number;
  paid_at: string | null; amount_paid: number | null; group_id: string | null; total_amount: number | null; split_pct: number | null;
  installment_group_id: string | null; installment_no: number | null; installment_count: number | null; expense_id?: string | null; status: BillStatus;
}
export interface Child extends SchoolScoped {
  name: string; birth_date: string | null; classroom: string; guardian_name: string; guardian_phone: string;
  enrollment_type: 'public' | 'private'; tuition_amount: number; enrollment_date: string | null; exit_date: string | null;
}
export type TuitionStatus = 'paid' | 'current' | '1-30' | '31-60' | '60+';
export interface Tuition extends SchoolScoped {
  child_id: string; period: string; base_amount: number; discount: number; due_date: string; paid_at: string | null; status: TuitionStatus;
}
export interface Entry extends SchoolScoped {
  date: string; type: 'revenue' | 'expense'; category: string; description: string; amount: number; one_off: number;
  group_id: string | null; total_amount: number | null; split_pct: number | null;
}
export interface CalendarMonth { month: number; factor: number; closed: boolean; school_days: number | null }
export interface Scenario extends SchoolScoped { name: string; adjustments: unknown[] }
export interface BankTransaction extends SchoolScoped {
  fitid: string; date: string; amount: number; name: string; suggested_kind: 'bill' | 'tuition' | null; suggested_id: string | null;
  reconciled: boolean; entry_id: string | null;
}
export interface AppUser extends Row { email: string; role: Role; school_ids: string[] }
export interface AuditEntry extends Row {
  user_email: string; action: string; entity: string; entity_id: string | null; school_id: string | null; before: unknown; after: unknown; at: string;
}

export type ConsolidatedReport = Report & { bySchool?: { id: string; name: string; revenue: number; accrualCost: number; result: number }[] };
export interface BillsPanel {
  today: string; totalOverdue: number; totalUpcoming: number;
  overdue: (Bill & { school?: string })[]; upcoming: (Bill & { school?: string })[];
}
export interface TuitionPanel {
  today: string; totalDue: number; totalOverdue: number; delinquencyPct: number | null;
  debtors: { id: string; child: string; school?: string; period: string; due_date: string; amount: number; bracket: TuitionStatus; message: string }[];
}
export interface Occupancy { active: number; capacity: number | null; pct: number | null }
export interface MetricsComparison {
  schools: (Metrics & { id: string; name: string })[]; consolidated: Metrics; winners: Record<string, string | null>;
}
export interface SimulationSummary { result: number; revenue: number; minBalance: number; minBalanceMonth: number; finalBalance: number; reserveNeeded: number }
export interface Simulation { base: SimulationSummary; scenario: SimulationSummary; warnings: string[] }
export interface InstallmentResult { installment_group_id: string; count: number; total: number; ids: string[] }
export interface OfxImportResult { imported: number; duplicates: number; ledgerBalance: number | null; ledgerDate: string | null }

export type Adjustment =
  | { type: 'delay_transfer'; months: number }
  | { type: 'hire'; salary: number; benefits?: number; hire_date?: string | null }
  | { type: 'terminate'; employee_id: string; date: string; severance_type?: string }
  | { type: 'cut_expense'; category: string; pct: number };
