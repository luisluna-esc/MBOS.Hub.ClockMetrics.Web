import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogService } from '../../../core/dialog/dialog.service';
import { QueryParams } from '../../../core/http/api.models';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../shared/components/filters/filters';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Select } from '../../../shared/components/select/select';
import { Table, TableAction, TableColumn } from '../../../shared/components/table/table';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { HeaderButton, ListPage, TableRow } from '../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { groupFilterOptions, groupOptions } from '../attendance-format';
import { Employee } from '../attendance.models';
import { AttendanceLookups, EmployeeService } from '../attendance.services';

type Row = TableRow<Employee>;

// Los empleados los crea la importación (por el AC-No del reloj). Aquí se les pone el grupo, se
// corrige el nombre para los reportes y se decide quién sale en los reportes.
@Component({
  selector: 'app-employees-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../shared/list-page/list-page.html',
})
export class EmployeesList extends ListPage<Employee> {
  private readonly dialogService = inject(DialogService);
  private readonly employeeService = inject(EmployeeService);
  private readonly lookups = inject(AttendanceLookups);

  protected readonly titleKey = 'nav.employees';
  protected override readonly subtitleKey = 'attendance.employees.subtitle';
  protected readonly headerButtons = computed<HeaderButton[]>(() => []);

  constructor() {
    super();
    void this.lookups.load('groups');
  }

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.employeeService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return {
      searchCriteria: values['search'],
      workGroupId: values['group'],
      includeInReports: this.bool(values['include']),
      isActive: this.bool(values['status']),
    };
  }

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('attendance.employees.search'), type: 'text' },
    { key: 'group', label: this.t('attendance.group'), type: 'select', options: groupFilterOptions(this.lookups.groups(), (k) => this.t(k)) },
    {
      key: 'include',
      label: this.t('attendance.employees.inReports'),
      type: 'select',
      options: [
        { value: 'true', label: this.t('attendance.yes') },
        { value: 'false', label: this.t('attendance.no') },
      ],
    },
    {
      key: 'status',
      label: this.t('catalogs.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.t('catalogs.active') },
        { value: 'false', label: this.t('catalogs.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'deviceCode', header: this.t('attendance.employees.deviceCode'), align: 'center' },
    { key: 'fullName', header: this.t('catalogs.columns.fullName') },
    {
      key: 'deviceName',
      header: this.t('attendance.employees.deviceName'),
      format: (v, row) => (v === row.fullName ? '' : String(v)),
    },
    { key: 'workGroupName', header: this.t('attendance.group'), format: (v) => (v ? String(v) : this.t('attendance.noGroup')) },
    { key: 'includeInReports', header: this.t('attendance.employees.inReports'), align: 'center', format: (v) => this.t(v ? 'attendance.yes' : 'attendance.no') },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'catalogs.active' : 'catalogs.inactive') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite() ? [{ label: this.t('catalogs.actions.edit'), icon: 'edit', onClick: (row) => this.openForm(row) }] : []
  );

  private openForm(employee: Employee): void {
    this.dialogService.open<boolean, EmployeeFormDialogData>(EmployeeFormDialog, { data: { employee } }).closed.subscribe((saved) => {
      if (saved) this.lookups.invalidate('employees');
      this.reloadIfSaved(saved);
    });
  }
}

export interface EmployeeFormDialogData {
  employee: Employee;
}

@Component({
  selector: 'app-employee-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, Select, TranslatePipe],
  template: `
    <app-dialog [title]="'attendance.employees.editTitle' | translate" [saveDisabled]="saveDisabled()" (save)="save()" (cancel)="dialogRef.close(false)">
      <form [formGroup]="form" class="flex flex-col gap-4">
        <p class="text-xs text-muted-foreground">
          {{ 'attendance.employees.deviceInfo' | translate: { code: employee.deviceCode, name: employee.deviceName } }}
        </p>
        <app-input formControlName="fullName" [label]="'attendance.employees.reportName' | translate" [required]="true" [maxLength]="150" />
        <app-select formControlName="workGroupId" [label]="'attendance.group' | translate" [options]="groupOptions()" />
        <app-checkbox formControlName="includeInReports">{{ 'attendance.employees.inReportsLong' | translate }}</app-checkbox>
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class EmployeeFormDialog extends FormDialog {
  protected readonly employee = inject<EmployeeFormDialogData>(DIALOG_DATA).employee;
  protected readonly dialogRef = inject(DialogRef<boolean, EmployeeFormDialog>);
  private readonly employeeService = inject(EmployeeService);
  private readonly lookups = inject(AttendanceLookups);

  protected readonly groupOptions = computed(() => groupOptions(this.lookups.groups(), (k) => this.languageService.t(k)));

  protected readonly form = new FormGroup({
    fullName: new FormControl(this.employee.fullName, { nonNullable: true, validators: Validators.required }),
    workGroupId: new FormControl<string | null>(this.employee.workGroupId ? String(this.employee.workGroupId) : ''),
    includeInReports: new FormControl(this.employee.includeInReports, { nonNullable: true }),
    isActive: new FormControl(this.employee.isActive, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
    void this.lookups.load('groups');
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    return this.submit(() =>
      this.employeeService.update(this.employee.employeeId, {
        fullName: raw.fullName.trim(),
        workGroupId: raw.workGroupId ? Number(raw.workGroupId) : null,
        includeInReports: raw.includeInReports,
        isActive: raw.isActive,
      })
    );
  }
}
