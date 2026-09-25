import { Inject, Injectable } from '@nestjs/common';
import { InputError } from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import { type CalendarDoc, DEFAULT_FACTOR, DEFAULT_SCHOOL_DAYS, type M } from '../database/schemas';
import { checkAllowed } from '../common/scope';
import { requireId, requireYear, type Body } from '../common/validation';

@Injectable()
export class CalendarService {
  constructor(@Inject(MODEL.Calendar) private readonly calendar: M<CalendarDoc>) {}

  // Makes sure the school has its 12 months for the year (city-hall transfer factor per month).
  async ensure(schoolId: unknown, year: number): Promise<void> {
    await this.calendar.bulkWrite(DEFAULT_FACTOR.map((factor, i) => ({
      updateOne: {
        filter: { school_id: schoolId as never, year, month: i + 1 },
        update: { $setOnInsert: { factor, school_days: DEFAULT_SCHOOL_DAYS[i] } },
        upsert: true,
      },
    })));
  }

  async get(schoolIdParam: unknown, yearParam: unknown, allowedIds: string[] | null) {
    const schoolId = requireId(schoolIdParam, 'school_id');
    checkAllowed(allowedIds, schoolId);
    const year = requireYear(yearParam);
    await this.ensure(schoolId, year);
    return this.calendar.find({ school_id: schoolId, year }).sort('month').select('month factor closed school_days -_id').lean();
  }

  async put(schoolIdParam: unknown, yearParam: unknown, allowedIds: string[] | null, body: Body) {
    const schoolId = requireId(schoolIdParam, 'school_id');
    checkAllowed(allowedIds, schoolId);
    const year = requireYear(yearParam);
    const { month, factor, closed, school_days } = body as { month?: unknown; factor?: unknown; closed?: unknown; school_days?: unknown };
    if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) throw new InputError('mes deve ser um inteiro de 1 a 12');
    if (factor !== undefined && !(Number(factor) >= 0 && Number(factor) <= 1)) throw new InputError('fator deve estar entre 0 e 1');
    if (school_days !== undefined && school_days !== null && !(Number(school_days) >= 0 && Number(school_days) <= 31)) throw new InputError('dias_letivos deve estar entre 0 e 31');
    const set: Record<string, unknown> = {};
    if (factor !== undefined) set.factor = Math.min(1, Math.max(0, Number(factor)));
    if (closed !== undefined) set.closed = !!closed;
    if (school_days !== undefined) set.school_days = school_days === null ? null : Number(school_days);
    await this.calendar.updateOne({ school_id: schoolId, year, month: month as number }, { $set: set });
    return { ok: true };
  }
}
