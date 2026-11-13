import { SelectOption } from '../../shared/components/select/select';
import { DayResult, Period, WorkGroup } from './attendance.models';

/** Minutos como "HH:MM" (los acumulados pasan de 24 h: no es una hora del día). */
export function hm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "08:01:00" → "08:01". */
export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

/** "2026-07-21" → "21/07/2026". */
export function dmy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Clave i18n del mes: months.1 ... months.12 (ya existen). */
export const monthKey = (month: number) => `months.${month}`;

/** Clave i18n del día de la semana corto. */
export const weekdayKey = (dayOfWeek: number) => `attendance.weekdays.${dayOfWeek}`;

export function periodOptions(periods: Period[], t: (key: string) => string): SelectOption[] {
  return periods.map((p) => ({
    value: String(p.attendancePeriodId),
    label: `${t(monthKey(p.month))} ${p.year}${p.isClosed ? ` · ${t('attendance.closed')}` : ''}`,
  }));
}

export function groupOptions(groups: WorkGroup[]): SelectOption[] {
  return groups.filter((g) => g.isActive).map((g) => ({ value: String(g.workGroupId), label: g.name }));
}

/** La casilla está vacía y debería tener marca (se pinta de amarillo, como el informe manual). */
export function isMissing(day: DayResult, slot: 'entryAm' | 'exitAm' | 'entryPm' | 'exitPm'): boolean {
  if (!day.isWorkingDay || day.excuseMissing) return false;
  if (day.isContinuous && (slot === 'exitAm' || slot === 'entryPm')) return false;
  return day[slot] === null;
}

/** La casilla no corresponde ese día (salida y regreso del receso en jornada continua). */
export function notApplicable(day: DayResult, slot: 'entryAm' | 'exitAm' | 'entryPm' | 'exitPm'): boolean {
  return day.isContinuous && (slot === 'exitAm' || slot === 'entryPm');
}
