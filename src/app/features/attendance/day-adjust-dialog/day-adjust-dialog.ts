import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorMessage } from '../../../core/http/api-error';
import { Badge } from '../../../shared/components/badge/badge';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Textarea } from '../../../shared/components/textarea/textarea';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, hhmm, hm, weekdayKey } from '../attendance-format';
import { DayResult, EmployeeSummary, JUSTIFICATION_TYPES } from '../attendance.models';
import { AttendanceService } from '../attendance.services';

export interface DayAdjustDialogData {
  employee: EmployeeSummary;
  day: DayResult;
}

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

// Corregir o justificar un día. Las marcas del biométrico no se tocan: el ajuste se guarda aparte
// con su motivo (queda en la auditoría) y "Quitar ajuste" vuelve el día a lo que marcó el reloj.
@Component({
  selector: 'app-day-adjust-dialog',
  imports: [ReactiveFormsModule, Badge, Checkbox, Dialog, AppInput, Select, Textarea, TranslatePipe],
  template: `
    <app-dialog
      [title]="'attendance.adjust.title' | translate: { name: data.employee.fullName }"
      size="large"
      [saveDisabled]="saveDisabled()"
      [extraLabel]="data.day.isAdjusted ? ('attendance.adjust.remove' | translate) : null"
      [extraDisabled]="saving()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
      (extra)="remove()"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span class="font-semibold text-foreground">{{ weekdayKey(data.day.dayOfWeek) | translate }} {{ dmy(data.day.date) }}</span>
          <span class="text-muted-foreground">
            {{ 'attendance.adjust.rawMarks' | translate }}:
            <span class="font-mono text-foreground">{{ data.day.rawMarks || ('attendance.adjust.noRawMarks' | translate) }}</span>
          </span>
          @if (data.day.lateMinutes > 0) {
            <span class="text-muted-foreground">{{ 'attendance.columns.lateTotal' | translate }}: <span class="text-foreground">{{ hm(data.day.lateMinutes) }}</span></span>
          }
          <div class="flex flex-wrap gap-1">
            @for (issue of data.day.issues; track issue) {
              <app-badge tone="warning">{{ 'attendance.issues.' + issue | translate }}</app-badge>
            }
          </div>
        </div>

        <form [formGroup]="form" class="flex flex-col gap-4">
          <app-checkbox formControlName="overrideMarks">{{ 'attendance.adjust.overrideMarks' | translate }}</app-checkbox>
          @if (overrideMarks()) {
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <app-input formControlName="entryAm" [label]="'attendance.columns.entryAm' | translate" placeholder="HH:mm" [patternRule]="timePattern" [errorMessages]="timeErrors()" />
              @if (!data.day.isContinuous) {
                <app-input formControlName="exitAm" [label]="'attendance.columns.exitAm' | translate" placeholder="HH:mm" [patternRule]="timePattern" [errorMessages]="timeErrors()" />
                <app-input formControlName="entryPm" [label]="'attendance.columns.entryPm' | translate" placeholder="HH:mm" [patternRule]="timePattern" [errorMessages]="timeErrors()" />
              }
              <app-input formControlName="exitPm" [label]="'attendance.columns.exitPm' | translate" placeholder="HH:mm" [patternRule]="timePattern" [errorMessages]="timeErrors()" />
            </div>
            <p class="text-xs text-muted-foreground">{{ 'attendance.adjust.overrideHint' | translate }}</p>
          }

          <app-select formControlName="justificationType" [label]="'attendance.adjust.justification' | translate" [options]="justificationOptions()" [placeholder]="'attendance.adjust.noJustification' | translate" />

          <div class="flex flex-col gap-2">
            <app-checkbox formControlName="excuseLateAm">{{ 'attendance.adjust.excuseLateAm' | translate }}</app-checkbox>
            @if (!data.day.isContinuous) {
              <app-checkbox formControlName="excuseLatePm">{{ 'attendance.adjust.excuseLatePm' | translate }}</app-checkbox>
            }
            <app-checkbox formControlName="excuseMissing">{{ 'attendance.adjust.excuseMissing' | translate }}</app-checkbox>
          </div>

          <app-textarea formControlName="reason" [label]="'attendance.adjust.reason' | translate" [required]="true" [maxLength]="500" />
        </form>
      </div>
    </app-dialog>
  `,
})
export class DayAdjustDialog extends FormDialog {
  protected readonly data = inject<DayAdjustDialogData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef<boolean, DayAdjustDialog>);
  private readonly attendanceService = inject(AttendanceService);

  protected readonly timePattern = TIME_PATTERN;
  protected readonly dmy = dmy;
  protected readonly hm = hm;
  protected readonly weekdayKey = weekdayKey;

  protected readonly form = new FormGroup({
    overrideMarks: new FormControl(this.data.day.overrideMarks, { nonNullable: true }),
    entryAm: new FormControl(hhmm(this.data.day.entryAm), { nonNullable: true }),
    exitAm: new FormControl(hhmm(this.data.day.exitAm), { nonNullable: true }),
    entryPm: new FormControl(hhmm(this.data.day.entryPm), { nonNullable: true }),
    exitPm: new FormControl(hhmm(this.data.day.exitPm), { nonNullable: true }),
    justificationType: new FormControl<string | null>(this.data.day.justificationType),
    excuseLateAm: new FormControl(this.data.day.excuseLateAm, { nonNullable: true }),
    excuseLatePm: new FormControl(this.data.day.excuseLatePm, { nonNullable: true }),
    excuseMissing: new FormControl(this.data.day.excuseMissing, { nonNullable: true }),
    reason: new FormControl(this.data.day.reason ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
  });

  protected readonly overrideMarks = toSignal(this.form.controls.overrideMarks.valueChanges, { initialValue: this.form.controls.overrideMarks.value });

  protected readonly justificationOptions = computed<SelectOption[]>(() =>
    JUSTIFICATION_TYPES.map((type) => ({ value: type, label: this.languageService.t(`attendance.justifications.${type}`) }))
  );

  protected readonly timeErrors = computed(() => ({ pattern: this.languageService.t('attendance.adjust.timeFormat') }));

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const time = (value: string) => (value.trim() ? value.trim().padStart(5, '0') : null);
    return this.submit(() =>
      this.attendanceService.saveAdjustment(this.data.employee.employeeId, this.data.day.date, {
        overrideMarks: raw.overrideMarks,
        entryAm: time(raw.entryAm),
        exitAm: time(raw.exitAm),
        entryPm: time(raw.entryPm),
        exitPm: time(raw.exitPm),
        justificationType: raw.justificationType || null,
        excuseLateAm: raw.excuseLateAm,
        excuseLatePm: raw.excuseLatePm,
        excuseMissing: raw.excuseMissing,
        reason: raw.reason.trim(),
      })
    );
  }

  protected async remove(): Promise<void> {
    this.saving.set(true);
    try {
      await this.attendanceService.deleteAdjustment(this.data.employee.employeeId, this.data.day.date);
      this.toastService.show(this.languageService.t('attendance.adjust.removed'));
      this.dialogRef.close(true);
    } catch (error) {
      this.toastService.show(this.languageService.t('common.saveError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.saving.set(false);
    }
  }
}
