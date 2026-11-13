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
import { Input as AppInput } from '../../../shared/components/input/input';
import { Table, TableAction, TableColumn } from '../../../shared/components/table/table';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { HeaderButton, ListPage, TableRow } from '../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, weekdayKey } from '../attendance-format';
import { Holiday } from '../attendance.models';
import { HolidayService } from '../attendance.services';
import { pageOf } from './page-of';

type Row = TableRow<Holiday>;

// Feriados: ese día no se cuentan atrasos ni faltas. Los móviles (Carnaval, Viernes Santo,
// Corpus Christi) y los traslados por decreto se cargan aquí cada año.
@Component({
  selector: 'app-holidays-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../shared/list-page/list-page.html',
})
export class HolidaysList extends ListPage<Holiday> {
  private readonly dialogService = inject(DialogService);
  private readonly holidayService = inject(HolidayService);

  protected readonly titleKey = 'nav.holidays';
  protected override readonly subtitleKey = 'attendance.holidays.subtitle';

  protected async fetchPage(pageNumber: number, pageSize: number, filters: QueryParams): Promise<PagedResult<Holiday>> {
    const year = filters['year'] ? Number(filters['year']) : null;
    return pageOf(await this.holidayService.all(year), pageNumber, pageSize);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { year: values['year'] };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite() ? [{ labelKey: 'attendance.holidays.new', primary: true, onClick: () => this.openForm(null) }] : []
  );

  protected readonly filterFields = computed<FilterField[]>(() => {
    const current = new Date().getFullYear();
    return [
      {
        key: 'year',
        label: this.t('attendance.year'),
        type: 'select',
        options: [current + 1, current, current - 1, current - 2].map((y) => ({ value: String(y), label: String(y) })),
      },
    ];
  });

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'date', header: this.t('attendance.columns.date'), format: (v) => `${dmy(String(v))} - ${this.t(weekdayKey(isoWeekday(String(v))))}` },
    { key: 'name', header: this.t('catalogs.columns.name') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite()
      ? [
          { label: this.t('catalogs.actions.edit'), icon: 'edit', onClick: (row) => this.openForm(row) },
          { label: this.t('catalogs.actions.delete'), icon: 'delete', variant: 'danger', onClick: (row) => this.confirmDelete(row) },
        ]
      : []
  );

  private openForm(holiday: Holiday | null): void {
    this.dialogService.open<boolean, HolidayFormDialogData>(HolidayFormDialog, { data: { holiday } }).closed.subscribe(this.reloadIfSaved);
  }

  private confirmDelete(row: Holiday): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('attendance.holidays.deleteTitle'), message: this.t('catalogs.deleteMessage', { name: `${dmy(row.date)} ${row.name}` }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe((confirmed) => confirmed && void this.run(() => this.holidayService.delete(row.holidayId), 'common.deleted'));
  }
}

/** "2026-08-06" → 1 (lunes) ... 7 (domingo), sin correrse por la zona horaria. */
function isoWeekday(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export interface HolidayFormDialogData {
  holiday: Holiday | null;
}

@Component({
  selector: 'app-holiday-form-dialog',
  imports: [ReactiveFormsModule, DatePicker, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog [title]="(holiday ? 'attendance.holidays.editTitle' : 'attendance.holidays.newTitle') | translate" [saveDisabled]="saveDisabled()" (save)="save()" (cancel)="dialogRef.close(false)">
      <form [formGroup]="form" class="flex flex-col gap-4">
        <app-date-picker formControlName="date" [label]="'attendance.columns.date' | translate" [required]="true" [allowFuture]="true" />
        <app-input formControlName="name" [label]="'catalogs.columns.name' | translate" [required]="true" [maxLength]="150" />
      </form>
    </app-dialog>
  `,
})
export class HolidayFormDialog extends FormDialog {
  protected readonly holiday = inject<HolidayFormDialogData>(DIALOG_DATA).holiday;
  protected readonly dialogRef = inject(DialogRef<boolean, HolidayFormDialog>);
  private readonly holidayService = inject(HolidayService);

  protected readonly form = new FormGroup({
    date: new FormControl<string | null>(this.holiday?.date ?? null, Validators.required),
    name: new FormControl(this.holiday?.name ?? '', { nonNullable: true, validators: Validators.required }),
  });

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const holiday: Holiday = { holidayId: this.holiday?.holidayId ?? 0, date: raw.date!, name: raw.name.trim() };
    return this.submit(() => (this.holiday ? this.holidayService.update(holiday) : this.holidayService.create(holiday)));
  }
}
