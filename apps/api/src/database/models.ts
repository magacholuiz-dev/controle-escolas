// Typed handles for injecting models: `@Inject(MODEL.School) school: M<SchoolDoc>`.
import { getModelToken } from '@nestjs/mongoose';
import type { ModelName } from './schemas';

export const MODEL = {
  School: getModelToken('School'), Employee: getModelToken('Employee'), Revenue: getModelToken('Revenue'), Expense: getModelToken('Expense'),
  Supplier: getModelToken('Supplier'), Bill: getModelToken('Bill'), Child: getModelToken('Child'), Tuition: getModelToken('Tuition'),
  Entry: getModelToken('Entry'), Calendar: getModelToken('Calendar'), BankTransaction: getModelToken('BankTransaction'),
  Scenario: getModelToken('Scenario'), User: getModelToken('User'), Session: getModelToken('Session'), AuditLog: getModelToken('AuditLog'),
} satisfies Record<ModelName, string>;
