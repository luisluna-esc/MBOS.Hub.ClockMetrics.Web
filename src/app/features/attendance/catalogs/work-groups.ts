import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogService } from '../../../core/dialog/dialog.service';
import { PagedResult, QueryParams } from '../../../core/http/api.models';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../shared/components/filters/filters';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Table, TableAction, TableColumn } from '../../../shared/components/table/table';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { HeaderButton, ListPage, TableRow } from '../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { WorkGroup } from '../attendance.models';
import { AttendanceLookups, WorkGroupService } from '../attendance.services';
import { pageOf } from './page-of';

type Row = TableRow<WorkGroup>;

// Grupos de los reportes (MBOS, ENT, EDUCEN, SPA). El orden define cómo salen en los resúmenes.
@Component({
  selector: 'app-work-groups-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../shared/list-page/list-page.html',
})
export class WorkGroupsList extends ListPage<WorkGroup> {
  private readonly dialogService = inject(DialogService);
  private readonly workGroupService = inject(WorkGroupService);
  private readonly lookups = inject(AttendanceLookups);

  protected readonly titleKey = 'nav.workGroups';
  protected override readonly subtitleKey = 'attendance.groups.subtitle';

  protected async fetchPage(pageNumber: number, pageSize: number, filters: QueryParams): Promise<PagedResult<WorkGroup>> {
    const search = String(filters['search'] ?? '').toLowerCase();
    const groups = (await this.workGroupService.all()).filter((g) => !search || g.name.toLowerCase().includes(search));
    return pageOf(groups, pageNumber, pageSize);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { search: values['search'] };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite() ? [{ labelKey: 'attendance.groups.new', primary: true, onClick: () => this.openForm(null) }] : []
  );

  protected readonly filterFields = computed<FilterField[]>(() => [{ key: 'search', label: this.t('catalogs.filters.search'), type: 'text' }]);

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'displayOrder', header: this.t('attendance.groups.order'), align: 'center' },
    { key: 'name', header: this.t('catalogs.columns.name') },
    { key: 'employeeCount', header: this.t('attendance.groups.employees'), align: 'center' },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'catalogs.active' : 'catalogs.inactive') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite()
      ? [
          { label: this.t('catalogs.actions.edit'), icon: 'edit', onClick: (row) => this.openForm(row) },
          { label: this.t('catalogs.actions.delete'), icon: 'delete', variant: 'danger', onClick: (row) => this.confirmDelete(row) },
        ]
      : []
  );

  private openForm(group: WorkGroup | null): void {
    this.dialogService.open<boolean, WorkGroupFormDialogData>(WorkGroupFormDialog, { data: { group } }).closed.subscribe((saved) => {
      if (saved) this.lookups.invalidate('groups');
      this.reloadIfSaved(saved);
    });
  }

  private confirmDelete(row: WorkGroup): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('attendance.groups.deleteTitle'), message: this.t('catalogs.deleteMessage', { name: row.name }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe((confirmed) => {
      if (!confirmed) return;
      this.lookups.invalidate('groups');
      void this.run(() => this.workGroupService.delete(row.workGroupId), 'common.deleted');
    });
  }
}

export interface WorkGroupFormDialogData {
  group: WorkGroup | null;
}

@Component({
  selector: 'app-work-group-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog [title]="(group ? 'attendance.groups.editTitle' : 'attendance.groups.newTitle') | translate" [saveDisabled]="saveDisabled()" (save)="save()" (cancel)="dialogRef.close(false)">
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-input formControlName="name" [label]="'catalogs.columns.name' | translate" [required]="true" [maxLength]="50" />
          <app-input formControlName="displayOrder" type="number" [decimals]="0" [label]="'attendance.groups.order' | translate" />
        </div>
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class WorkGroupFormDialog extends FormDialog {
  protected readonly group = inject<WorkGroupFormDialogData>(DIALOG_DATA).group;
  protected readonly dialogRef = inject(DialogRef<boolean, WorkGroupFormDialog>);
  private readonly workGroupService = inject(WorkGroupService);

  protected readonly form = new FormGroup({
    name: new FormControl(this.group?.name ?? '', { nonNullable: true, validators: Validators.required }),
    displayOrder: new FormControl<string | null>(String(this.group?.displayOrder ?? 0)),
    isActive: new FormControl(this.group?.isActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const group: WorkGroup = {
      workGroupId: this.group?.workGroupId ?? 0,
      name: raw.name.trim(),
      displayOrder: Number(raw.displayOrder) || 0,
      isActive: raw.isActive,
      employeeCount: 0,
    };
    return this.submit(() => (this.group ? this.workGroupService.update(group) : this.workGroupService.create(group)));
  }
}
