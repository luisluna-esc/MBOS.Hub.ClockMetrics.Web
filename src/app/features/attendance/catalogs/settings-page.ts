import { Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AttendanceSettings } from '../attendance.models';
import { AttendanceSettingsService } from '../attendance.services';

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

type DayForm = FormGroup<{
  dayOfWeek: FormControl<number>;
  isWorkingDay: FormControl<boolean>;
  startTime: FormControl<string>;
  breakStart: FormControl<string>;
  breakEnd: FormControl<string>;
  endTime: FormControl<string>;
}>;

// Horario de cada día y reglas del cálculo. Los días se calculan al consultarlos, así que un cambio
// aquí se ve en todas las pantallas y reportes al instante.
@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, Checkbox, AppInput, Skeleton, TranslatePipe],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  private readonly settingsService = inject(AttendanceSettingsService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  protected readonly authService = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly timePattern = TIME;

  protected readonly form = new FormGroup({
    toleranceMinutes: new FormControl<string | null>(null, Validators.required),
    duplicateWindowMinutes: new FormControl<string | null>(null, Validators.required),
    minBreakMinutes: new FormControl<string | null>(null, Validators.required),
    middayFrom: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(TIME)] }),
    afternoonExitFrom: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(TIME)] }),
    earliestNormalTime: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(TIME)] }),
    latestNormalTime: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(TIME)] }),
    periodCutoffDay: new FormControl<string | null>(null, Validators.required),
    schedules: new FormArray<DayForm>([]),
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const settings = await this.settingsService.get();
      this.form.patchValue({
        toleranceMinutes: String(settings.toleranceMinutes),
        duplicateWindowMinutes: String(settings.duplicateWindowMinutes),
        minBreakMinutes: String(settings.minBreakMinutes),
        middayFrom: settings.middayFrom,
        afternoonExitFrom: settings.afternoonExitFrom,
        earliestNormalTime: settings.earliestNormalTime,
        latestNormalTime: settings.latestNormalTime,
        periodCutoffDay: String(settings.periodCutoffDay),
      });
      this.form.controls.schedules.clear();
      for (const day of settings.schedules) {
        this.form.controls.schedules.push(
          new FormGroup({
            dayOfWeek: new FormControl(day.dayOfWeek, { nonNullable: true }),
            isWorkingDay: new FormControl(day.isWorkingDay, { nonNullable: true }),
            startTime: new FormControl(day.startTime ?? '', { nonNullable: true, validators: Validators.pattern(TIME) }),
            breakStart: new FormControl(day.breakStart ?? '', { nonNullable: true, validators: Validators.pattern(TIME) }),
            breakEnd: new FormControl(day.breakEnd ?? '', { nonNullable: true, validators: Validators.pattern(TIME) }),
            endTime: new FormControl(day.endTime ?? '', { nonNullable: true, validators: Validators.pattern(TIME) }),
          })
        );
      }
      if (!this.authService.canWrite()) this.form.disable();
    } catch {
      this.toastService.show(this.languageService.t('common.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    const time = (value: string) => (value.trim() ? value.trim().padStart(5, '0') : null);
    const settings: AttendanceSettings = {
      toleranceMinutes: Number(raw.toleranceMinutes),
      duplicateWindowMinutes: Number(raw.duplicateWindowMinutes),
      minBreakMinutes: Number(raw.minBreakMinutes),
      middayFrom: time(raw.middayFrom)!,
      afternoonExitFrom: time(raw.afternoonExitFrom)!,
      earliestNormalTime: time(raw.earliestNormalTime)!,
      latestNormalTime: time(raw.latestNormalTime)!,
      periodCutoffDay: Number(raw.periodCutoffDay),
      schedules: raw.schedules.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isWorkingDay: d.isWorkingDay,
        startTime: time(d.startTime),
        breakStart: time(d.breakStart),
        breakEnd: time(d.breakEnd),
        endTime: time(d.endTime),
      })),
    };
    this.saving.set(true);
    try {
      await this.settingsService.update(settings);
      this.toastService.show(this.languageService.t('common.saved'));
    } catch (error) {
      this.toastService.show(this.languageService.t('common.saveError'), apiErrorMessage(error) ?? undefined, 10000);
    } finally {
      this.saving.set(false);
    }
  }
}
