import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Table, TableColumn } from '../../../shared/components/table/table';
import { TableRow } from '../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, monthKey } from '../attendance-format';
import { AttendanceImport, ImportResult } from '../attendance.models';
import { AttendanceLookups, AttendanceService } from '../attendance.services';

type Row = TableRow<AttendanceImport>;

// Subir el archivo que exporta el biométrico (agosto.xls). El backend lo lee, crea los empleados
// nuevos y los períodos, y reemplaza las marcas de esos días (los ajustes de RR.HH. se conservan).
@Component({
  selector: 'app-import-page',
  imports: [RouterLink, Table, TranslatePipe],
  templateUrl: './import-page.html',
})
export class ImportPage {
  private readonly attendanceService = inject(AttendanceService);
  private readonly lookups = inject(AttendanceLookups);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  protected readonly authService = inject(AuthService);

  protected readonly file = signal<File | null>(null);
  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);
  protected readonly result = signal<ImportResult | null>(null);

  protected readonly history = signal<AttendanceImport[]>([]);
  protected readonly historyTotal = signal(0);
  protected readonly historyPage = signal(1);
  protected readonly historyPageSize = signal(5);
  protected readonly historyLoading = signal(false);

  protected readonly dmy = dmy;
  protected readonly monthKey = monthKey;

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'importedAt', header: this.t('attendance.import.importedAt'), format: (v) => new Date(v as string).toLocaleString() },
    { key: 'fileName', header: this.t('attendance.import.file') },
    { key: 'firstDate', header: this.t('attendance.import.dates'), format: (_, row) => `${dmy(row.firstDate)} – ${dmy(row.lastDate)}` },
    { key: 'employeeCount', header: this.t('attendance.import.employees'), align: 'center' },
    { key: 'newEmployeeCount', header: this.t('attendance.import.newEmployees'), align: 'center' },
    { key: 'markCount', header: this.t('attendance.import.marks'), align: 'center' },
    { key: 'importedByName', header: this.t('attendance.import.importedBy') },
  ]);

  constructor() {
    void this.loadHistory();
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.result.set(null);
    input.value = '';
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.file.set(file);
      this.result.set(null);
    }
  }

  protected async upload(): Promise<void> {
    const file = this.file();
    if (!file || this.uploading()) return;
    this.uploading.set(true);
    try {
      const response = await this.attendanceService.import(file);
      this.result.set(response.data);
      this.file.set(null);
      this.lookups.invalidate('periods', 'employees');
      this.toastService.show(this.t('attendance.import.done'));
      void this.loadHistory();
    } catch (error) {
      this.toastService.show(this.t('attendance.import.error'), apiErrorMessage(error) ?? undefined, 10000);
    } finally {
      this.uploading.set(false);
    }
  }

  protected async loadHistory(): Promise<void> {
    this.historyLoading.set(true);
    try {
      const page = await this.attendanceService.imports(this.historyPage(), this.historyPageSize());
      this.history.set(page.items);
      this.historyTotal.set(page.totalRecords);
    } catch {
      this.history.set([]);
    } finally {
      this.historyLoading.set(false);
    }
  }

  protected onPageChange(page: number): void {
    this.historyPage.set(page);
    void this.loadHistory();
  }

  protected onPageSizeChange(size: number): void {
    this.historyPageSize.set(size);
    this.historyPage.set(1);
    void this.loadHistory();
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.languageService.t(key, params);
  }
}
