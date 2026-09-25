import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { InputError } from '@controle-escolas/domain';

// Portuguese labels for each field, used to build error messages the person can act on.
const LABELS: Record<string, string> = {
  name: 'nome', description: 'descrição', category: 'categoria', amount: 'valor', monthly_amount: 'valor mensal', date: 'data', type: 'tipo',
  school_id: 'escola', salary: 'salário', benefits: 'benefícios', hire_date: 'data de admissão', termination_date: 'data de desligamento',
  vacation_month: 'mês das férias', payroll_tax_pct: 'encargos (%)', tax_pct: 'impostos (%)', initial_balance: 'saldo inicial', children_count: 'crianças',
};
const label = (field: string): string => LABELS[field] ?? field;

interface MongooseFieldError { path: string; kind: string }
interface MongooseError extends Error { path?: string; errors?: Record<string, MongooseFieldError> }

// Translates Mongoose errors into a sentence the person can act on.
export function validationMessage(e: MongooseError): string {
  if (e.name === 'CastError') return `Valor inválido no campo "${label(e.path ?? '')}".`;
  if (e.name !== 'ValidationError') return e.message;
  return Object.values(e.errors ?? {}).map((x) => {
    const field = label(x.path);
    if (x.kind === 'required') return `Preencha o campo "${field}".`;
    if (x.kind === 'min' || x.kind === 'max') return `Valor fora da faixa permitida em "${field}".`;
    if (x.kind === 'enum') return `Valor não permitido em "${field}".`;
    return `Valor inválido no campo "${field}".`;
  }).join(' ');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(e: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const err = e as MongooseError & { status?: number; statusCode?: number; type?: string };

    let status = 500;
    let message = 'erro interno';
    if (e instanceof InputError) { status = e.status; message = e.message; }
    else if (err.name === 'ValidationError' || err.name === 'CastError') { status = 400; message = validationMessage(err); }
    else if (err.type === 'entity.too.large') { status = 413; message = 'corpo da requisição grande demais'; }
    else if (err.type === 'entity.parse.failed') { status = 400; message = 'corpo da requisição não é um JSON de objeto válido'; }
    else if (e instanceof HttpException) {
      status = e.getStatus();
      message = status === 404 ? 'não encontrado' : status === 405 ? 'método não suportado' : e.message;
    } else this.logger.error(err.stack ?? String(e));

    res.status(status).json({ error: message });
  }
}
