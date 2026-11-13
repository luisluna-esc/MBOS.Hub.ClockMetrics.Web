import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../core/dialog/dialog.service';
import { apiErrorCode } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { Badge } from '../../../shared/components/badge/badge';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, groupFilterOptions, hhmm, hm, periodOptions, weekdayKey } from '../attendance-format';
import { IssueRow } from '../attendance.models';
import { AttendanceLookups, AttendanceService } from '../attendance.services';
import { DayAdjustDialog, DayAdjustDialogData } from '../day-adjust-dialog/day-adjust-dialog';

/** Tipos de incoherencia, en el orden en que conviene revisarlos. */
const ISSUE_TYPES = ['MARCAS_EXTRA', 'DUPLICADA', 'RECESO_CORTO', 'HORA_INUSUAL', 'FALTA_MARCA', 'SIN_MARCAS', 'MARCAS_DIA_NO_LABORAL'];

// Los días que el cálculo no pudo resolver solo (marcas repetidas, de más, faltantes, receso corto,
// horas raras). RR.HH. los revisa uno por uno: al corregir o justificar, el día sale de la lista
// (salvo que se muestren también los revisados).
@Component({
  selector: 'app-issues-page',
  imports: [FormsModule, RouterLink, Badge, Checkbox, ErrorState, Select, Skeleton, TranslatePipe],
  templateUrl: './issues-page.html',
})
export class IssuesPage {
  private readonly attendanceService = inject(AttendanceService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly lookups = inject(AttendanceLookups);

  readonly period = input<string | undefined>();

  protected readonly periodId = signal<string | null>(null);
  protected readonly groupId = signal<string | null>('');
  protected readonly issueType = signal<string | null>(null);
  protected readonly includeReviewed = signal(false);
  protected readonly rows = signal<IssueRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);
  private readonly ready = signal(false);

  protected readonly dmy = dmy;
  protected readonly hm = hm;
  protected readonly hhmm = hhmm;
  protected readonly weekdayKey = weekdayKey;

  protected readonly periodOptions = computed(() => periodOptions(this.lookups.periods(), (k) => this.languageService.t(k)));
  protected readonly groupOptions = computed(() => groupFilterOptions(this.lookups.groups(), (k) => this.languageService.t(k)));
  protected readonly issueOptions = computed<SelectOption[]>(() =>
    ISSUE_TYPES.map((type) => ({ value: type, label: this.languageService.t(`attendance.issues.${type}`) }))
  );
  protected readonly selectedPeriod = computed(() => this.lookups.periods().find((p) => String(p.attendancePeriodId) === this.periodId()) ?? null);
  protected readonly canEdit = computed(() => this.authService.canWrite() && !this.selectedPeriod()?.isClosed);

  protected readonly visibleRows = computed(() => {
    const type = this.issueType();
    return type ? this.rows().filter((r) => r.day.issues.includes(type)) : this.rows();
  });

  /** Cuántos días hay de cada tipo, para los chips de arriba. */
  protected readonly counts = computed(() => {
    const counts: Record<string, number> = {};
    for (const row of this.rows()) for (const issue of row.day.issues) counts[issue] = (counts[issue] ?? 0) + 1;
    return ISSUE_TYPES.filter((type) => counts[type]).map((type) => ({ type, count: counts[type] }));
  });

  constructor() {
    void this.init();
    effect(() => {
      const periodId = this.periodId();
      this.groupId();
      this.includeReviewed();
      if (!this.ready()) return;
      untracked(() => {
        void this.router.navigate([], { queryParams: { period: periodId }, replaceUrl: true });
        void this.reload();
      });
    });
  }

  private async init(): Promise<void> {
    await this.lookups.load('periods', 'groups');
    this.periodId.set(this.period() ?? (this.lookups.periods()[0] ? String(this.lookups.periods()[0].attendancePeriodId) : null));
    this.ready.set(true);
  }

  protected async reload(): Promise<void> {
    const periodId = this.periodId();
    if (!periodId) return;
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      this.rows.set(await this.attendanceService.issues(Number(periodId), { workGroupId: this.groupId(), includeReviewed: this.includeReviewed() }));
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected open(row: IssueRow): void {
    if (!this.canEdit()) return;
    this.dialogService
      .open<boolean, DayAdjustDialogData>(DayAdjustDialog, { data: { employee: row.employee, day: row.day } })
      .closed.subscribe((saved) => saved && void this.reload());
  }

  protected toggleType(type: string): void {
    this.issueType.set(this.issueType() === type ? null : type);
  }
}
