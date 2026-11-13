import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../core/dialog/dialog.service';
import { apiErrorCode, apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Badge } from '../../../shared/components/badge/badge';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, hhmm, hm, isMissing, notApplicable, periodOptions, weekdayKey } from '../attendance-format';
import { DayResult, EmployeeMonth as EmployeeMonthData, ReportFormat } from '../attendance.models';
import { AttendanceLookups, AttendanceService } from '../attendance.services';
import { DayAdjustDialog, DayAdjustDialogData } from '../day-adjust-dialog/day-adjust-dialog';

type Slot = 'entryAm' | 'exitAm' | 'entryPm' | 'exitPm';

// Registro jornada laboral de un empleado: la misma hoja del PDF, con las casillas que faltan en
// amarillo. Un clic en un día laborable abre el ajuste (corregir marcas o justificar). El período
// y el empleado van en la URL (?period=1&employee=5) para poder llegar desde Incoherencias.
@Component({
  selector: 'app-employee-month',
  imports: [FormsModule, Badge, ErrorState, Select, Skeleton, TranslatePipe],
  templateUrl: './employee-month.html',
})
export class EmployeeMonth {
  private readonly attendanceService = inject(AttendanceService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly lookups = inject(AttendanceLookups);

  /** Query params (withComponentInputBinding). */
  readonly period = input<string | undefined>();
  readonly employee = input<string | undefined>();

  protected readonly periodId = signal<string | null>(null);
  protected readonly employeeId = signal<string | null>(null);
  protected readonly data = signal<EmployeeMonthData | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly downloading = signal(false);
  /** Hasta leer la URL no se recarga ni se reescribe (si no, se borrarían los parámetros). */
  private readonly ready = signal(false);

  protected readonly slots: Slot[] = ['entryAm', 'exitAm', 'entryPm', 'exitPm'];
  protected readonly dmy = dmy;
  protected readonly hm = hm;
  protected readonly hhmm = hhmm;
  protected readonly weekdayKey = weekdayKey;
  protected readonly isMissing = isMissing;
  protected readonly notApplicable = notApplicable;

  protected readonly periodOptions = computed(() => periodOptions(this.lookups.periods(), (k) => this.languageService.t(k)));
  protected readonly employeeOptions = computed<SelectOption[]>(() =>
    this.lookups
      .employees()
      .filter((e) => e.isActive)
      .map((e) => ({ value: String(e.employeeId), label: `${e.fullName}${e.workGroupName ? ` · ${e.workGroupName}` : ''}` }))
  );
  protected readonly canEdit = computed(() => this.authService.canWrite() && !this.data()?.period.isClosed);

  constructor() {
    void this.init();

    // Al cambiar de período o empleado se recarga y se deja en la URL.
    effect(() => {
      const periodId = this.periodId();
      const employeeId = this.employeeId();
      if (!this.ready()) return;
      untracked(() => {
        void this.router.navigate([], { queryParams: { period: periodId, employee: employeeId }, replaceUrl: true });
        void this.reload();
      });
    });
  }

  private async init(): Promise<void> {
    await this.lookups.load('periods', 'employees');
    this.periodId.set(this.period() ?? (this.lookups.periods()[0] ? String(this.lookups.periods()[0].attendancePeriodId) : null));
    this.employeeId.set(this.employee() ?? null);
    this.ready.set(true);
  }

  protected async reload(): Promise<void> {
    const periodId = this.periodId();
    const employeeId = this.employeeId();
    if (!periodId || !employeeId) {
      this.data.set(null);
      return;
    }
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      this.data.set(await this.attendanceService.employeeMonth(Number(periodId), Number(employeeId)));
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected openDay(day: DayResult): void {
    const data = this.data();
    if (!data || !day.isWorkingDay || !this.canEdit()) return;
    this.dialogService
      .open<boolean, DayAdjustDialogData>(DayAdjustDialog, { data: { employee: data.employee, day } })
      .closed.subscribe((saved) => saved && void this.reload());
  }

  protected async download(format: ReportFormat): Promise<void> {
    const data = this.data();
    if (!data || this.downloading()) return;
    this.downloading.set(true);
    try {
      await this.attendanceService.downloadEmployeeReport(
        data.period.attendancePeriodId,
        format,
        { employeeId: data.employee.employeeId },
        `registro-${data.employee.fullName}-${data.period.year}-${String(data.period.month).padStart(2, '0')}`
      );
    } catch (error) {
      this.toastService.show(this.languageService.t('attendance.reportError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.downloading.set(false);
    }
  }

  protected rowLabel(day: DayResult): string | null {
    if (day.holidayName) return `${this.languageService.t('attendance.holiday')} - ${day.holidayName}`;
    if (!day.isWorkingDay) return this.languageService.t(`attendance.weekdaysLong.${day.dayOfWeek}`);
    return null;
  }

  protected observation(day: DayResult): string {
    if (day.isAdjusted) {
      const parts = [];
      if (day.justificationType) parts.push(this.languageService.t(`attendance.justifications.${day.justificationType}`));
      if (day.overrideMarks) parts.push(this.languageService.t('attendance.adjust.marksCorrected'));
      if (day.excuseLateAm || day.excuseLatePm) parts.push(this.languageService.t('attendance.adjust.lateExcused'));
      return parts.join(' · ');
    }
    return '';
  }
}
