'use client';
import { useState } from 'react';
import type { AppUser, AuditEntry, BankTransaction, Bill, OfxImportResult, School, Tuition } from '@controle-escolas/contracts';
import { api } from '@/lib/api';
import { brl, isoToMonthBr, tone } from '@/lib/format';
import { auditActionLabel, auditDetail } from '@/lib/audit';
import { useApp, useTargetSchool } from '@/lib/store';
import { useFetch } from '@/lib/useFetch';
import { Card, ErrorNote, Loading, Note, TableWrap } from '@/components/ui';
import { FieldInput, type FieldSpec } from '@/components/fields';
import { useDialogs } from '@/components/dialogs';
import { MONTHS } from '@/lib/format';

const B = ({ children }: { children: React.ReactNode }) => <b>{children}</b>;

export function BankScreen() {
  const school = useTargetSchool();
  const { notify, prompt, confirm, run } = useDialogs();
  const list = useFetch<BankTransaction[]>(`bank/list?school=${school.id}`);
  const bills = useFetch<Bill[]>(`bills?school_id=${school.id}`);
  const tuitions = useFetch<Tuition[]>(`tuition?school_id=${school.id}`);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  if (list.error) return <ErrorNote message={list.error} />;
  if (!list.data || !bills.data || !tuitions.data) return <Loading />;
  const billById = new Map(bills.data.map((b) => [b.id, b]));
  const tuitionById = new Map(tuitions.data.map((t) => [t.id, t]));

  const suggestion = (t: BankTransaction): string => {
    if (!t.suggested_kind) return '—';
    if (t.suggested_kind === 'bill') { const b = billById.get(t.suggested_id ?? ''); return b ? `Conta: ${b.description}` : 'Conta (removida)'; }
    const c = tuitionById.get(t.suggested_id ?? '');
    return c ? `Mensalidade: ${isoToMonthBr(c.period)}` : 'Mensalidade (removida)';
  };

  const importFile = () => run(async () => {
    if (!file) { notify('Escolha um arquivo .ofx primeiro.', 'error'); return; }
    const r = await api.post<OfxImportResult>('bank/import', { school_id: school.id, ofx: await file.text() });
    notify(`${r.imported} movimento(s) novo(s) importado(s)${r.duplicates ? `, ${r.duplicates} já existiam` : ''}.`);
    setFile(null); setFileKey((k) => k + 1);
    list.reload(); bills.reload(); tuitions.reload();
  });
  const confirmTx = async (tx: BankTransaction) => {
    if (!(await confirm('Confirmar a sugestão? Isso baixa a conta/mensalidade de verdade.'))) return;
    await run(async () => { await api.post(`bank/${tx.id}/confirm`); list.reload(); bills.reload(); tuitions.reload(); });
  };
  const manual = async (tx: BankTransaction) => {
    const category = await prompt('Categoria do lançamento:', 'Outros'); if (category === null) return;
    const description = await prompt('Descrição:', ''); if (description === null) return;
    await run(async () => { await api.post(`bank/${tx.id}/manual`, { category, description }); list.reload(); });
  };

  return (
    <>
      <Note>Importe o extrato do banco (arquivo .ofx) de <B>{school.name}</B>. Movimentos já importados não duplicam. Cada movimento pode ser confirmado contra a conta ou mensalidade sugerida (baixando-a de verdade) ou lançado manualmente numa categoria, quando não há sugestão.</Note>
      <div className="add">
        <input key={fileKey} type="file" accept=".ofx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Arquivo OFX" />
        <button type="button" onClick={importFile}>Importar extrato (.ofx)</button>
      </div>
      <Card title="Movimentos importados" sub={list.data.length ? '' : 'Nenhum movimento importado ainda.'}>
        <TableWrap>
          <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Sugestão</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {list.data.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.date}</td><td>{tx.name || '—'}</td><td className={tone(tx.amount)}>{brl(tx.amount)}</td><td>{suggestion(tx)}</td>
                <td>{tx.reconciled ? <span className="pos">Conciliado</span> : <span className="neg">Pendente</span>}</td>
                <td className="actions">
                  {!tx.reconciled && tx.suggested_kind && <button type="button" onClick={() => confirmTx(tx)}>Confirmar</button>}
                  {!tx.reconciled && <button type="button" className="sec" onClick={() => manual(tx)}>Lançar manualmente</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}

export function UsersScreen() {
  const { schools, user } = useApp();
  const { confirm, prompt, notify, run } = useDialogs();
  const users = useFetch<AppUser[]>('users');
  const audit = useFetch<AuditEntry[]>('audit');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'director' | 'owner'>('director');
  const [checked, setChecked] = useState<string[]>([]);
  if (users.error) return <ErrorNote message={users.error} />;
  if (!users.data || !audit.data) return <Loading />;
  const schoolName = (id: string | null): string => (id ? schools.find((s) => s.id === id)?.name ?? id : '—');

  return (
    <>
      <Note>Só a dona gerencia usuários. Cada diretora só acessa a(s) escola(s) marcadas para ela. Trocar a senha aqui não exige a senha antiga.</Note>
      <Card title="Usuários">
        <TableWrap>
          <thead><tr><th>E-mail</th><th>Papel</th><th>Escolas</th><th /></tr></thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td><td>{u.role === 'owner' ? 'Dona (todas)' : 'Diretora'}</td>
                <td>{u.school_ids.map(schoolName).join(', ') || '—'}</td>
                <td className="actions">
                  <button type="button" className="sec" onClick={async () => {
                    const pw = await prompt('Nova senha (mínimo 8 caracteres):'); if (pw === null) return;
                    await run(async () => { await api.put(`users/${u.id}`, { password: pw }); notify('Senha alterada.'); });
                  }}>Nova senha</button>
                  {u.id !== user?.id && <button type="button" className="sec" onClick={async () => {
                    if (await confirm('Excluir este usuário? O acesso é revogado imediatamente.')) await run(async () => { await api.del(`users/${u.id}`); users.reload(); });
                  }}>Excluir</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Card title="Criar usuário" sub="A diretora precisa de ao menos uma escola marcada">
        <div className="add">
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
          <input type="password" placeholder="Senha (mín. 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Senha" />
          <select value={role} onChange={(e) => setRole(e.target.value as 'director' | 'owner')} aria-label="Papel">
            <option value="director">Diretora</option><option value="owner">Dona</option>
          </select>
          {role === 'director' && schools.map((s) => (
            <label key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={checked.includes(s.id)} onChange={(e) => setChecked((c) => (e.target.checked ? [...c, s.id] : c.filter((x) => x !== s.id)))} /> {s.name}
            </label>
          ))}
          <button type="button" onClick={() => run(async () => {
            await api.post('users', { email, password, role, school_ids: checked });
            setEmail(''); setPassword(''); setChecked([]); users.reload(); audit.reload();
          })}>Criar usuário</button>
        </div>
      </Card>

      {audit.data.length > 0 && (
        <Card title="Log de atividade (últimas 100)" sub="O que cada usuário fez, mais recente primeiro">
          <TableWrap>
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Escola</th><th>Detalhe</th></tr></thead>
            <tbody>
              {audit.data.slice(0, 100).map((a) => (
                <tr key={a.id}><td>{new Date(a.at).toLocaleString('pt-BR')}</td><td>{a.user_email}</td><td>{auditActionLabel(a.action)}</td><td>{schoolName(a.school_id)}</td><td>{auditDetail(a.before, a.after)}</td></tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}
    </>
  );
}

const SETTINGS_FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Nome', type: 'text' },
  { key: 'payroll_tax_pct', label: 'Encargos sobre folha (%)', type: 'num' },
  { key: 'tax_pct', label: 'Impostos sobre receita (%)', type: 'num' },
  { key: 'initial_balance', label: 'Saldo inicial de caixa', type: 'money' },
  { key: 'vacation_month', label: 'Mês padrão das férias', type: 'select', options: MONTHS.map((m, i): [number, string] => [i + 1, m]) },
  { key: 'children_count', label: 'Crianças matriculadas (rateio)', type: 'num' },
  { key: 'capacity', label: 'Capacidade (vagas)', type: 'num' },
  { key: 'child_daily_rate', label: 'Valor por criança-dia (Prefeitura)', type: 'money' },
  { key: 'tuition_due_day', label: 'Dia de vencimento das mensalidades', type: 'num' },
  { key: 'turnover_pct', label: 'Rotatividade anual (%) — reserva de rescisão', type: 'num' },
];

export function SettingsScreen() {
  const { run } = useDialogs();
  const setSchools = useApp((s) => s.setSchools);
  const schools = useFetch<School[]>('schools');
  if (!schools.data) return <Loading />;
  return (
    <>
      <Note>Percentuais por escola. <B>Encargos</B>: FGTS 8% (Simples Nacional); se a escola não for do Simples, some INSS patronal/RAT/terceiros. <B>Imposto</B>: alíquota efetiva sobre a receita — confirme com a contabilidade. <B>Saldo inicial</B>: caixa em 1º de janeiro. <B>Crianças matriculadas</B>: campo manual, usado para dividir compras proporcionalmente entre as escolas (independente da aba Crianças). <B>Capacidade</B>: vagas totais, para a ocupação. <B>Valor por criança-dia (Prefeitura)</B>: assim que houver ao menos uma criança de vaga da Prefeitura cadastrada, a receita passa a ser crianças × dias letivos × esse valor, no lugar da receita manual &quot;segue calendário&quot;. <B>Rotatividade anual</B>: liga a reserva mensal de rescisão (0% = desligada); é uma provisão no lucro, nunca sai do caixa até alguém realmente sair — confirme o número real com a contabilidade.</Note>
      <div className="card edit">
        <table>
          <thead><tr>{SETTINGS_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
          <tbody>
            {schools.data.map((s) => (
              <tr key={s.id}>
                {SETTINGS_FIELDS.map((f) => (
                  <td key={f.key}><FieldInput spec={f} value={(s as unknown as Record<string, string | number | null>)[f.key]} onCommit={(v) => run(async () => {
                    await api.put(`schools/${s.id}`, { [f.key]: v });
                    const fresh = await api.get<School[]>('schools');
                    setSchools(fresh); schools.reload();
                  })} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
