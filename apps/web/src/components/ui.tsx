import type { ReactNode } from 'react';

export function Card({ title, sub, legend, className = '', children }: {
  title: string; sub?: string; legend?: [string, string][]; className?: string; children?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      <h2>{title}</h2>
      {sub !== undefined && <div className="sub">{sub}</div>}
      {legend && legend.length > 1 && (
        <div className="legend">{legend.map(([name, color]) => <span key={name}><i style={{ background: `var(--${color})` }} />{name}</span>)}</div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ title, value, sub, tone = '' }: { title: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="card kpi">
      <div className="t">{title}</div>
      <div className={`v ${tone}`}>{value}</div>
      {sub !== undefined && <div className="s">{sub}</div>}
    </div>
  );
}

export const TableWrap = ({ children }: { children: ReactNode }) => <div className="table-wrap"><table>{children}</table></div>;
export const Note = ({ children }: { children: ReactNode }) => <p className="note">{children}</p>;
export const Warning = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => <div className="warning" style={style}>{children}</div>;
export const Loading = () => <p className="note" aria-busy="true">Carregando…</p>;
export const ErrorNote = ({ message }: { message: string }) => <p className="note neg" role="alert">Erro: {message}</p>;
