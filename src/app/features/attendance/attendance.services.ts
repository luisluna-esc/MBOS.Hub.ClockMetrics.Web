import { Injectable, inject, signal } from '@angular/core';
import { QueryParams } from '../../core/http/api.models';
import { ApiService } from '../../core/http/api.service';
import { saveBlob } from '../../core/http/save-blob';
import {
  Accumulated,
  AdjustmentRequest,
  AttendanceImport,
  AttendanceSettings,
  Employee,
  EmployeeMonth,
  EmployeeRequest,
  Holiday,
  ImportResult,
  IssueRow,
  Period,
  PeriodRequest,
  PeriodSummary,
  ReportFormat,
  WorkGroup,
} from './attendance.models';

// Un servicio por recurso de /api. Los filtros usan los nombres de los QueryFilter del backend
// (AttendanceQueryFilter: workGroupId, employeeId, onlyIncludedInReports).

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly api = inject(ApiService);

  /** Sube el archivo del biométrico. */
  import(file: File): Promise<{ data: ImportResult }> {
    const body = new FormData();
    body.append('file', file);
    return this.api.postRaw<{ data: ImportResult }>('/attendance/imports', body);
  }

  imports = (pageNumber: number, pageSize: number) => this.api.list<AttendanceImport>('/attendance/imports', pageNumber, pageSize);
  employeeMonth = (periodId: number, employeeId: number) => this.api.get<EmployeeMonth>(`/attendance/periods/${periodId}/employees/${employeeId}`);
  summary = (periodId: number, filters: QueryParams = {}) => this.api.get<PeriodSummary>(`/attendance/periods/${periodId}/summary`, filters);
  issues = (periodId: number, filters: QueryParams = {}) => this.api.get<IssueRow[]>(`/attendance/periods/${periodId}/issues`, filters);
  accumulated = (fromPeriodId: number, toPeriodId: number, filters: QueryParams = {}) =>
    this.api.get<Accumulated>('/attendance/accumulated', { fromPeriodId, toPeriodId, ...filters });

  saveAdjustment = (employeeId: number, date: string, request: AdjustmentRequest) => this.api.put(`/attendance/employees/${employeeId}/days/${date}`, request);
  deleteAdjustment = (employeeId: number, date: string) => this.api.delete(`/attendance/employees/${employeeId}/days/${date}`);

  /** Registro jornada laboral: de un empleado (employeeId) o de todos los del filtro. */
  async downloadEmployeeReport(periodId: number, format: ReportFormat, filters: QueryParams, fileName: string): Promise<void> {
    saveBlob(await this.api.download(`/attendance/periods/${periodId}/reports/employees/${format}`, filters), `${fileName}.${ext(format)}`);
  }

  async downloadSummary(periodId: number, format: ReportFormat, filters: QueryParams, fileName: string): Promise<void> {
    saveBlob(await this.api.download(`/attendance/periods/${periodId}/reports/summary/${format}`, filters), `${fileName}.${ext(format)}`);
  }

  async downloadAccumulated(fromPeriodId: number, toPeriodId: number, format: ReportFormat, filters: QueryParams, fileName: string): Promise<void> {
    saveBlob(
      await this.api.download(`/attendance/reports/accumulated/${format}`, { fromPeriodId, toPeriodId, ...filters }),
      `${fileName}.${ext(format)}`
    );
  }
}

const ext = (format: ReportFormat) => (format === 'Pdf' ? 'pdf' : 'xlsx');

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<Employee>('/employees', pageNumber, pageSize, filters);
  all = (filters: QueryParams = {}) => this.api.all<Employee>('/employees', filters);
  update = (employeeId: number, request: EmployeeRequest) => this.api.put(`/employees/${employeeId}`, request);
}

@Injectable({ providedIn: 'root' })
export class WorkGroupService {
  private readonly api = inject(ApiService);

  all = () => this.api.get<WorkGroup[]>('/workgroups');
  create = (group: WorkGroup) => this.api.post('/workgroups', group);
  update = (group: WorkGroup) => this.api.put(`/workgroups/${group.workGroupId}`, group);
  delete = (workGroupId: number) => this.api.delete(`/workgroups/${workGroupId}`);
}

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly api = inject(ApiService);

  all = (year: number | null) => this.api.get<Holiday[]>('/holidays', { year });
  create = (holiday: Holiday) => this.api.post('/holidays', holiday);
  update = (holiday: Holiday) => this.api.put(`/holidays/${holiday.holidayId}`, holiday);
  delete = (holidayId: number) => this.api.delete(`/holidays/${holidayId}`);
}

@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly api = inject(ApiService);

  all = (year: number | null = null) => this.api.get<Period[]>('/attendanceperiods', { year });
  create = (request: PeriodRequest) => this.api.post('/attendanceperiods', request);
  update = (periodId: number, request: PeriodRequest) => this.api.put(`/attendanceperiods/${periodId}`, request);
  close = (periodId: number) => this.api.post(`/attendanceperiods/${periodId}/close`);
  reopen = (periodId: number) => this.api.post(`/attendanceperiods/${periodId}/reopen`);
}

@Injectable({ providedIn: 'root' })
export class AttendanceSettingsService {
  private readonly api = inject(ApiService);

  get = () => this.api.get<AttendanceSettings>('/attendancesettings');
  update = (settings: AttendanceSettings) => this.api.put('/attendancesettings', settings);
}

/**
 * Períodos, grupos y empleados para los selects de las pantallas de asistencia. Se cargan una vez
 * y se vuelven a pedir con invalidate() después de importar o de editar un catálogo.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceLookups {
  private readonly periodService = inject(PeriodService);
  private readonly workGroupService = inject(WorkGroupService);
  private readonly employeeService = inject(EmployeeService);

  readonly periods = signal<Period[]>([]);
  readonly groups = signal<WorkGroup[]>([]);
  readonly employees = signal<Employee[]>([]);
  private loaded = new Set<string>();

  async load(...what: ('periods' | 'groups' | 'employees')[]): Promise<void> {
    await Promise.all(
      what
        .filter((key) => !this.loaded.has(key))
        .map(async (key) => {
          if (key === 'periods') this.periods.set(await this.periodService.all());
          if (key === 'groups') this.groups.set(await this.workGroupService.all());
          if (key === 'employees') this.employees.set(await this.employeeService.all());
          this.loaded.add(key);
        })
    );
  }

  invalidate(...what: ('periods' | 'groups' | 'employees')[]): void {
    for (const key of what) this.loaded.delete(key);
  }
}
