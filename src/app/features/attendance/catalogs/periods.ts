import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogService } from '../../../core/dialog/dialog.service';
import { PagedResult, QueryParams } from '../../../core/http/api.models';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../shared/components/filters/filters';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Table, TableAction, TableColumn } from '../../../shared/components/table/table';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { HeaderButton, ListPage, TableRow } from '../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, monthKey } from '../attendance-format';
import { Period } from '../attendance.models';
import { AttendanceLookups, PeriodService } from '../attendance.services';
import { pageOf } from './page-of';

type Row = TableRow<Period>;

// Los períodos (21 al 20) los crea la importación. Aquí se corrigen sus fechas cuando el corte fue
// distinto (febrero 2026 empezó el 01/02) y se cierran: cerrado, ya no se importa ni se ajusta.
@Component({
  selector: 'app-periods-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../shared/list-page/list-page.html',
})
export class PeriodsList extends ListPage<Period> {
  private readonly dialogService = inject(DialogService);
  private readonly periodService = inject(PeriodService);
  private readonly lookups = inject(AttendanceLookups);

  protected readonly titleKey = 'nav.periods';
  protected override readonly subtitleKey = 'attendance.periods.subtitle';
  protected readonly filterFields = computed<FilterField[]>(() => []);

  protected async fetchPage(pageNumber: number, pageSize: number): Promise<PagedResult<Period>> {
    return pageOf(await this.periodService.all(), pageNumber, pageSize);
  }

  protected toQuery(_: FilterValues): QueryParams {
    return {};
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite() ? [{ labelKey: 'attendance.periods.new', primary: true, onClick: () => this.openForm(null) }] : []
  );

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'month', header: this.t('attendance.period'), format: (_, row) => `${this.t(monthKey(row.month))} ${row.year}` },
    { key: 'startDate', header: this.t('attendance.periods.start'), format: (v) => dmy(String(v)) },
    { key: 'endDate', header: this.t('attendance.periods.end'), format: (v) => dmy(String(v)) },
    { key: 'dayCount', header: this.t('attendance.periods.days'), align: 'center' },
    { key: 'isClosed', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'attendance.closed' : 'attendance.open') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite()
      ? [
          {
            label: this.t('catalogs.actions.edit'),
            icon: 'edit',
            onClick: (row) => this.openForm(row),
            disabled: (row) => row.isClosed,
            disabledReason: () => this.t('attendance.periods.reopenToEdit'),
          },
          { label: this.t('attendance.periods.close'), icon: 'verified', onClick: (row) => this.confirmClose(row), disabled: (row) => row.isClosed },
          { label: this.t('attendance.periods.reopen'), icon: 'return', onClick: (row) => this.reopen(row), disabled: (row) => !row.isClosed },
        ]
      : []
  );

  private openForm(period: Period | null): void {
    this.dialogService.open<boolean, PeriodFormDialogData>(PeriodFormDialog, { data: { period } }).closed.subscribe((saved) => {
      if (saved) this.lookups.invalidate('periods');
      this.reloadIfSaved(saved);
    });
  }

  private confirmClose(row: Period): void {
    const name = `${this.t(monthKey(row.month))} ${row.year}`;
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('attendance.periods.closeTitle'), message: this.t('attendance.periods.closeMessage', { name }), confirmLabel: this.t('attendance.periods.close') },
    });
    ref.closed.subscribe((confirmed) => {
      if (!confirmed) return;
      this.lookups.invalidate('periods');
      void this.run(() => this.periodService.close(row.attendancePeriodId));
    });
  }

  private reopen(row: Period): void {
    this.lookups.invalidate('periods');
    void this.run(() => this.periodService.reopen(row.attendancePeriodId));
  }
}

export interface PeriodFormDialogData {
  period: Period | null;
}

@Component({
  selector: 'app-period-form-dialog',
  imports: [ReactiveFormsModule, DatePicker, Dialog, AppInput, Select, TranslatePipe],
  template: `
    <app-dialog [title]="(period ? 'attendance.periods.editTitle' : 'attendance.periods.newTitle') | translate" [saveDisabled]="saveDisabled()" (save)="save()" (cancel)="dialogRef.close(false)">
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select formControlName="month" [label]="'attendance.month' | translate" [options]="monthOptions()" [required]="true" />
          <app-input formControlName="year" type="number" [decimals]="0" [label]="'attendance.year' | translate" [required]="true" />
          <app-date-picker formControlName="startDate" [label]="'attendance.periods.start' | translate" [required]="true" [allowFuture]="true" />
          <app-date-picker formControlName="endDate" [label]="'attendance.periods.end' | translate" [required]="true" [allowFuture]="true" />
        </div>
        <p class="text-xs text-muted-foreground">{{ 'attendance.periods.formHint' | translate }}</p>
      </form>
    </app-dialog>
  `,
})
export class PeriodFormDialog extends FormDialog {
  protected readonly period = inject<PeriodFormDialogData>(DIALOG_DATA).period;
  protected readonly dialogRef = inject(DialogRef<boolean, PeriodFormDialog>);
  private readonly periodService = inject(PeriodService);

  protected readonly monthOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: this.languageService.t(monthKey(i + 1)) }))
  );

  protected readonly form = new FormGroup({
    month: new FormControl<string | null>(this.period ? String(this.period.month) : null, Validators.required),
    year: new FormControl<string | null>(String(this.period?.year ?? new Date().getFullYear()), Validators.required),
    startDate: new FormControl<string | null>(this.period?.startDate ?? null, Validators.required),
    endDate: new FormControl<string | null>(this.period?.endDate ?? null, Validators.required),
  });

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const request = { year: Number(raw.year), month: Number(raw.month), startDate: raw.startDate!, endDate: raw.endDate! };
    return this.submit(() => (this.period ? this.periodService.update(this.period.attendancePeriodId, request) : this.periodService.create(request)));
  }
}
