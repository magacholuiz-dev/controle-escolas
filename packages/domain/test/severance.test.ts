import { test } from 'vitest';
import assert from 'node:assert/strict';
import { calculateSeverance } from '../src/severance';

test('severance: legacy assertions, ported 1:1', () => {

  const v = (r, name) => r.lines.find((l) => l.name === name)?.amount;

  // Without cause: salary 3000, hired 10/03/2023, left 18/09/2026, notice paid in lieu, 3 vacation periods taken.
  // 3 full years -> 39-day notice -> projected date 27/10/2026.
  let r = calculateSeverance({ salary: 3000, hire_date: '2023-03-10', termination_date: '2026-09-18', type: 'without_cause', vacation_periods_taken: 3 });
  assert.equal(r.projectedDate, '2026-10-27');
  assert.equal(v(r, 'Saldo de salário'), 1800);                 // 18 days × 100
  assert.equal(v(r, 'Aviso prévio indenizado'), 3900);          // 39 days × 100
  assert.equal(v(r, '13º salário proporcional'), 2500);         // 10/12 (Jan..Oct, Oct with 27 days)
  assert.equal(v(r, 'Férias vencidas'), undefined);
  assert.equal(v(r, 'Férias proporcionais'), 2000);             // 8/12: 7 months + 17 days
  assert.equal(v(r, '1/3 constitucional sobre férias proporcionais'), 666.67);
  assert.equal(r.totalToEmployee, 1800 + 3900 + 2500 + 2000 + 666.67);
  // Estimated FGTS: 42 months × 3000 × 8% × 13/12 = 10920; severance deposit 8% × (1800+3900+2500) = 656
  assert.equal(r.fgts.estimatedBalance, 10920);
  assert.equal(r.fgts.severanceDeposit, 656);
  assert.equal(r.fgts.fine, 4630.4);                            // 40% × (10920 + 656)
  assert.equal(r.schoolCost, r.totalToEmployee + 656 + 4630.4);

  // Mutual agreement: 50% notice, 20% fine
  r = calculateSeverance({ salary: 3000, hire_date: '2023-03-10', termination_date: '2026-09-18', type: 'mutual_agreement', vacation_periods_taken: 3 });
  assert.equal(v(r, 'Aviso prévio indenizado'), 1950);
  assert.equal(r.fgts.finePct, 0.2);
  assert.equal(r.fgts.withdrawalAllowed, '80%');

  // Resignation: no pay-in-lieu notice, no fine; discount if notice isn't worked
  r = calculateSeverance({ salary: 3000, hire_date: '2023-03-10', termination_date: '2026-09-18', type: 'resignation', vacation_periods_taken: 3, notice_worked: false });
  assert.equal(v(r, 'Aviso prévio indenizado'), undefined);
  assert.equal(v(r, '(−) Desconto de aviso prévio não cumprido'), -3000);
  assert.equal(r.fgts.fine, 0);
  assert.equal(v(r, '13º salário proporcional'), 2250);         // no projection: Jan..Sep (Sep with 18 days) = 9/12

  // For cause: only the salary balance (and vested vacation, if any)
  r = calculateSeverance({ salary: 3000, hire_date: '2023-03-10', termination_date: '2026-09-18', type: 'for_cause', vacation_periods_taken: 3 });
  assert.deepEqual(r.lines.map((l) => l.name), ['Saldo de salário']);
  assert.equal(r.fgts.fine, 0);

  // Vacation vested and not taken for more than 12 months -> double-pay warning
  r = calculateSeverance({ salary: 3000, hire_date: '2023-03-10', termination_date: '2026-09-18', type: 'for_cause', vacation_periods_taken: 1 });
  assert.equal(v(r, 'Férias vencidas'), 6000);                  // 2 vested periods (2024/25 and 2025/26)
  assert.ok(r.warnings.some((a) => a.includes('dobro')));

  // First year: hired 01/06/2026 (13th counts all of June), leaves 20/09/2026 without cause, 30-day notice
  r = calculateSeverance({ salary: 2400, hire_date: '2026-06-01', termination_date: '2026-09-20', type: 'without_cause' });
  assert.equal(r.noticeDays, 30);
  assert.equal(r.projectedDate, '2026-10-20');
  assert.equal(v(r, '13º salário proporcional'), 1000);         // Jun..Oct = 5/12 × 2400
  assert.equal(v(r, 'Férias proporcionais'), 1000);             // 4 months + 19 days -> 5/12
  assert.equal(v(r, 'Férias vencidas'), undefined);

  // 90-day notice cap (20 years of tenure)
  r = calculateSeverance({ salary: 3000, hire_date: '2005-01-05', termination_date: '2026-09-18', type: 'without_cause', vacation_periods_taken: 21 });
  assert.equal(r.noticeDays, 90);

  assert.throws(() => calculateSeverance({ salary: 1, hire_date: '2026-05-01', termination_date: '2026-04-01', type: 'mutual_agreement' }));

});
