// Populates a demo database with sample data. Only runs if the database has no revenues yet.
import mongoose from 'mongoose';
import { connect, School, Revenue, Employee, Expense, Entry } from './db.js';
import { prorate } from './proration.js';
import { randomUUID } from 'node:crypto';

await connect();
if ((await Revenue.countDocuments()) === 0) {
  const schools = await School.find().sort('_id'); // Novo Mundo, CIC
  const year = new Date().getFullYear();
  await School.updateOne({ _id: schools[0]._id }, { children_count: 62, initial_balance: 15000 });
  await School.updateOne({ _id: schools[1]._id }, { children_count: 48 });

  for (const [school, base, aux] of [[schools[0], 60000, 8], [schools[1], 42000, 5]]) {
    const school_id = school._id;
    await Revenue.create([
      { school_id, description: 'Contrato Prefeitura', monthly_amount: base, follows_calendar: 1 },
      { school_id, description: 'Mensalidades particulares', monthly_amount: base / 8, follows_calendar: 0 },
    ]);
    await Employee.create([
      { school_id, name: 'Professora regente', role: 'Professora', salary: 3200, benefits: 600, hire_date: '2021-02-01', vacation_periods_taken: 4 },
      ...Array.from({ length: aux }, (_, i) => ({ school_id, name: `Auxiliar ${i + 1}`, role: 'Auxiliar', salary: 2300, benefits: 500, hire_date: `${2022 + (i % 3)}-0${1 + (i % 9)}-15`, vacation_periods_taken: i % 3 })),
    ]);
    await Expense.create([
      { school_id, description: 'Alimentação', category: 'Alimentação', monthly_amount: base * 0.15, follows_calendar: 1 },
      { school_id, description: 'Aluguel', category: 'Aluguel', monthly_amount: base * 0.11 },
      { school_id, description: 'Água', category: 'Água', monthly_amount: base * 0.012 },
      { school_id, description: 'Luz', category: 'Luz', monthly_amount: base * 0.02 },
      { school_id, description: 'Internet', category: 'Internet', monthly_amount: 250 },
      { school_id, description: 'Segurança / alarme', category: 'Segurança', monthly_amount: 480 },
    ]);
    await Entry.create({ school_id, date: `${year}-03-08`, type: 'expense', category: 'Luz', description: 'Conta de março', amount: base * 0.022 });
  }

  // Kitchenware purchase, split proportionally to enrollment.
  const splits = prorate(1850, schools.map((s, i) => ({ id: String(s._id), children_count: [62, 48][i] })), 'children');
  const group_id = randomUUID();
  await Entry.create(splits.map((p) => ({
    school_id: p.school_id, date: `${year}-03-12`, type: 'expense', category: 'Material de cozinha', one_off: 1,
    description: 'Panelas e utensílios de cozinha', amount: p.amount, group_id, total_amount: 1850, split_pct: p.pct,
  })));
}
await mongoose.disconnect();
