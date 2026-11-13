import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorCode, apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Select } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { groupOptions, hm, monthKey, periodOptions } from '../attendance-format';
import { Accumulated as AccumulatedData, ReportFormat } from '../attendance.models';
import { AttendanceLookups, AttendanceService } from '../attendance.services';

// Cuadro resumen de atrasos de varios meses, de más a menos atrasado (como la hoja RESUMEN). El
// Excel trae además una hoja por mes, igual que el archivo manual de febrero a abril.
@Component({
  selector: 'app-accumulated',
  imports: [FormsModule, ErrorState, Select, Skeleton, TranslatePipe],
  templateUrl: './accumulated.html',
})
export class Accumulated {
  private readonly attendanceService = inject(AttendanceService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  protected readonly lookups = inject(AttendanceLookups);

  protected readonly fromId = signal<string | null>(null);
  protected readonly toId = signal<string | null>(null);
  protected readonly groupId = signal<string | null>(null);
  protected readonly data = signal<AccumulatedData | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly downloading = signal(false);

  protected readonly hm = hm;
  protected readonly monthKey = monthKey;

  protected readonly periodOptions = computed(() => periodOptions(this.lookups.periods(), (k) => this.languageService.t(k)));
  protected readonly groupOptions = computed(() => groupOptions(this.lookups.groups()));

  constructor() {
    void this.init();
    effect(() => {
      this.fromId();
      this.toId();
      this.groupId();
      untracked(() => void this.reload());
    });
  }

  private async init(): Promise<void> {
    await this.lookups.load('periods', 'groups');
    // Por defecto los últimos tres meses (los períodos vienen del más nuevo al más viejo).
    const periods = this.lookups.periods();
    if (periods.length) {
      this.toId.set(String(periods[0].attendancePeriodId));
      this.fromId.set(String(periods[Math.min(2, periods.length - 1)].attendancePeriodId));
    }
  }

  protected async reload(): Promise<void> {
    const from = this.fromId();
    const to = this.toId();
    if (!from || !to) return;
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      this.data.set(await this.attendanceService.accumulated(Number(from), Number(to), { workGroupId: this.groupId() }));
    } catch (error) {
      this.data.set(null);
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async download(format: ReportFormat): Promise<void> {
    const from = this.fromId();
    const to = this.toId();
    if (!from || !to || this.downloading()) return;
    this.downloading.set(true);
    try {
      await this.attendanceService.downloadAccumulated(Number(from), Number(to), format, { workGroupId: this.groupId() }, 'acumulado-atrasos');
    } catch (error) {
      this.toastService.show(this.languageService.t('attendance.reportError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.downloading.set(false);
    }
  }
}
