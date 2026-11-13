import { Component, inject, input, output } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { Badge } from '../../../shared/components/badge/badge';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, hhmm, hm, isMissing, notApplicable, weekdayKey } from '../attendance-format';
import { DayResult, EmployeeMonth } from '../attendance.models';

type Slot = 'entryAm' | 'exitAm' | 'entryPm' | 'exitPm';

// Registro jornada laboral de un empleado (la hoja del PDF): tarjetas con los totales y la tabla de
// días, con las casillas que faltan en amarillo. Lo usa el registro de un empleado y la vista de
// todos (uno debajo del otro).
@Component({
  selector: 'app-day-table',
  imports: [Badge, TranslatePipe],
  templateUrl: './day-table.html',
})
export class DayTable {
  private readonly languageService = inject(LanguageService);

  readonly month = input.required<EmployeeMonth>();
  /** Si se puede hacer clic en un día para ajustarlo. */
  readonly canEdit = input(false);
  /** En la vista de todos las tarjetas ocupan menos lugar. */
  readonly compact = input(false);
  readonly dayClick = output<DayResult>();

  protected readonly slots: Slot[] = ['entryAm', 'exitAm', 'entryPm', 'exitPm'];
  protected readonly dmy = dmy;
  protected readonly hm = hm;
  protected readonly hhmm = hhmm;
  protected readonly weekdayKey = weekdayKey;
  protected readonly isMissing = isMissing;
  protected readonly notApplicable = notApplicable;

  protected open(day: DayResult): void {
    if (day.isWorkingDay && this.canEdit()) this.dayClick.emit(day);
  }

  protected rowLabel(day: DayResult): string | null {
    if (day.holidayName) return `${this.languageService.t('attendance.holiday')} - ${day.holidayName}`;
    if (!day.isWorkingDay) return this.languageService.t(`attendance.weekdaysLong.${day.dayOfWeek}`);
    return null;
  }

  protected observation(day: DayResult): string {
    const parts = [];
    if (day.justificationType) parts.push(this.languageService.t(`attendance.justifications.${day.justificationType}`));
    if (day.overrideMarks) parts.push(this.languageService.t('attendance.adjust.marksCorrected'));
    if (day.excuseLateAm || day.excuseLatePm) parts.push(this.languageService.t('attendance.adjust.lateExcused'));
    return parts.join(' · ');
  }
}
