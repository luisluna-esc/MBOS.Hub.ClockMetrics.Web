import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../core/dialog/dialog.service';
import { apiErrorCode, apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { groupFilterOptions, monthKey, periodOptions } from '../attendance-format';
import { DayResult, EmployeeMonth as EmployeeMonthData, ReportFormat } from '../attendance.models';
import { AttendanceLookups, AttendanceService } from '../attendance.services';
import { DayAdjustDialog, DayAdjustDialogData } from '../day-adjust-dialog/day-adjust-dialog';
import { DayTable } from '../day-table/day-table';

// Registro jornada laboral: de un empleado o de todos (vista general, uno debajo del otro como en
// el PDF, con filtro de grupo). Un clic en un día laborable abre el ajuste. El período, el
// empleado y el grupo van en la URL para poder llegar desde Incoherencias o el resumen.
@Component({
  selector: 'app-employee-month',
  imports: [FormsModule, DayTable, ErrorState, Select, Skeleton, TranslatePipe],
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
  readonly group = input<string | undefined>();

  protected readonly periodId = signal<string | null>(null);
  /** Vacío = todos los empleados. */
  protected readonly employeeId = signal<string | null>('');
  protected readonly groupId = signal<string | null>('');
  protected readonly months = signal<EmployeeMonthData[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly downloading = signal(false);
  /** Hasta leer la URL no se recarga ni se reescribe (si no, se borrarían los parámetros). */
  private readonly ready = signal(false);

  protected readonly monthKey = monthKey;

  protected readonly isAll = computed(() => !this.employeeId());
  protected readonly periodOptions = computed(() => periodOptions(this.lookups.periods(), (k) => this.languageService.t(k)));
  protected readonly groupOptions = computed(() => groupFilterOptions(this.lookups.groups(), (k) => this.languageService.t(k)));
  protected readonly employeeOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('attendance.allEmployees') },
    ...this.lookups
      .employees()
      .filter((e) => e.isActive)
      .map((e) => ({ value: String(e.employeeId), label: `${e.fullName}${e.workGroupName ? ` · ${e.workGroupName}` : ''}` })),
  ]);
  protected readonly selectedPeriod = computed(() => this.lookups.periods().find((p) => String(p.attendancePeriodId) === this.periodId()) ?? null);
  protected readonly canEdit = computed(() => this.authService.canWrite() && !this.selectedPeriod()?.isClosed);

  constructor() {
    void this.init();

    effect(() => {
      const periodId = this.periodId();
      const employeeId = this.employeeId();
      const groupId = this.groupId();
      if (!this.ready()) return;
      untracked(() => {
        void this.router.navigate([], {
          queryParams: { period: periodId, employee: employeeId || null, group: employeeId ? null : groupId || null },
          replaceUrl: true,
        });
        void this.reload();
      });
    });
  }

  private async init(): Promise<void> {
    await this.lookups.load('periods', 'employees', 'groups');
    this.periodId.set(this.period() ?? (this.lookups.periods()[0] ? String(this.lookups.periods()[0].attendancePeriodId) : null));
    this.employeeId.set(this.employee() ?? '');
    this.groupId.set(this.group() ?? '');
    this.ready.set(true);
  }

  protected async reload(): Promise<void> {
    const periodId = this.periodId();
    if (!periodId) {
      this.months.set([]);
      return;
    }
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const employeeId = this.employeeId();
      this.months.set(
        employeeId
          ? [await this.attendanceService.employeeMonth(Number(periodId), Number(employeeId))]
          : await this.attendanceService.records(Number(periodId), { workGroupId: this.groupId() })
      );
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected openDay(month: EmployeeMonthData, day: DayResult): void {
    if (!this.canEdit()) return;
    this.dialogService
      .open<boolean, DayAdjustDialogData>(DayAdjustDialog, { data: { employee: month.employee, day } })
      .closed.subscribe((saved) => saved && void this.reload());
  }

  protected async download(format: ReportFormat): Promise<void> {
    const period = this.selectedPeriod();
    if (!period || this.downloading()) return;
    this.downloading.set(true);
    const suffix = `${period.year}-${String(period.month).padStart(2, '0')}`;
    try {
      const single = this.isAll() ? null : this.months()[0]?.employee;
      await this.attendanceService.downloadEmployeeReport(
        period.attendancePeriodId,
        format,
        single ? { employeeId: single.employeeId } : { workGroupId: this.groupId() },
        single ? `registro-${single.fullName}-${suffix}` : `registro-jornada-${suffix}`
      );
    } catch (error) {
      this.toastService.show(this.languageService.t('attendance.reportError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.downloading.set(false);
    }
  }
}
