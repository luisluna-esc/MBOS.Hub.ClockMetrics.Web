import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorCode, apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Select } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, groupFilterOptions, hm, monthKey, periodOptions } from '../attendance-format';
import { PeriodSummary, ReportFormat, SummaryRow } from '../attendance.models';
import { AttendanceLookups, AttendanceService } from '../attendance.services';

// Resumen del mes (como la hoja FEBRERO del Excel manual): por empleado, cantidad de atrasos,
// tiempo de atraso, ingresos y salidas no marcadas, días no marcados. Desde aquí también se baja
// el registro jornada laboral de todos (una hoja por empleado, como el PDF del biométrico).
@Component({
  selector: 'app-month-summary',
  imports: [FormsModule, RouterLink, ErrorState, Select, Skeleton, TranslatePipe],
  templateUrl: './month-summary.html',
})
export class MonthSummary {
  private readonly attendanceService = inject(AttendanceService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  protected readonly lookups = inject(AttendanceLookups);

  protected readonly periodId = signal<string | null>(null);
  protected readonly groupId = signal<string | null>('');
  protected readonly data = signal<PeriodSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly downloading = signal(false);

  protected readonly hm = hm;
  protected readonly dmy = dmy;
  protected readonly monthKey = monthKey;

  protected readonly periodOptions = computed(() => periodOptions(this.lookups.periods(), (k) => this.languageService.t(k)));
  protected readonly groupOptions = computed(() => groupFilterOptions(this.lookups.groups(), (k) => this.languageService.t(k)));

  /** Filas agrupadas como el Excel manual (la numeración vuelve a 1 en cada grupo). */
  protected readonly groups = computed(() => {
    const groups: { name: string; rows: SummaryRow[] }[] = [];
    for (const row of this.data()?.rows ?? []) {
      const name = row.employee.workGroupName ?? this.languageService.t('attendance.noGroup');
      let group = groups.find((g) => g.name === name);
      if (!group) groups.push((group = { name, rows: [] }));
      group.rows.push(row);
    }
    return groups;
  });

  constructor() {
    void this.init();
    effect(() => {
      this.periodId();
      this.groupId();
      untracked(() => void this.reload());
    });
  }

  private async init(): Promise<void> {
    await this.lookups.load('periods', 'groups');
    const first = this.lookups.periods()[0];
    if (first) this.periodId.set(String(first.attendancePeriodId));
  }

  protected async reload(): Promise<void> {
    const periodId = this.periodId();
    if (!periodId) return;
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      this.data.set(await this.attendanceService.summary(Number(periodId), { workGroupId: this.groupId() }));
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async download(kind: 'summary' | 'employees', format: ReportFormat): Promise<void> {
    const data = this.data();
    if (!data || this.downloading()) return;
    this.downloading.set(true);
    const p = data.period;
    const suffix = `${p.year}-${String(p.month).padStart(2, '0')}`;
    try {
      if (kind === 'summary') {
        await this.attendanceService.downloadSummary(p.attendancePeriodId, format, { workGroupId: this.groupId() }, `resumen-asistencia-${suffix}`);
      } else {
        await this.attendanceService.downloadEmployeeReport(p.attendancePeriodId, format, { workGroupId: this.groupId() }, `registro-jornada-${suffix}`);
      }
    } catch (error) {
      this.toastService.show(this.languageService.t('attendance.reportError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.downloading.set(false);
    }
  }
}
