// Mismos formatos que los DTOs del backend (ClockMetrics.Application/Dtos/Attendance y Attendance/DayResult).

export interface Period {
  attendancePeriodId: number;
  year: number;
  month: number;
  /** yyyy-MM-dd */
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt: string | null;
  dayCount: number;
}

export interface EmployeeSummary {
  employeeId: number;
  deviceCode: string;
  fullName: string;
  workGroupId: number | null;
  workGroupName: string | null;
}

/** Un día calculado (DayResult). Las horas llegan como "HH:mm:ss". */
export interface DayResult {
  date: string;
  /** 1 = lunes ... 7 = domingo */
  dayOfWeek: number;
  status: DayStatus;
  holidayName: string | null;
  isContinuous: boolean;
  rawMarks: string;
  entryAm: string | null;
  exitAm: string | null;
  entryPm: string | null;
  exitPm: string | null;
  lateAmMinutes: number;
  latePmMinutes: number;
  lateMinutes: number;
  lateCount: number;
  workedMinutes: number | null;
  missingEntries: number;
  missingExits: number;
  unmarkedHalves: number;
  issues: string[];
  isAdjusted: boolean;
  overrideMarks: boolean;
  justificationType: string | null;
  excuseLateAm: boolean;
  excuseLatePm: boolean;
  excuseMissing: boolean;
  reason: string | null;
  isWorkingDay: boolean;
}

export type DayStatus = 'NO_LABORAL' | 'FERIADO' | 'SIN_MARCAS' | 'INCOMPLETO' | 'COMPLETO' | 'JUSTIFICADO';

export interface AttendanceTotals {
  workingDays: number;
  completeDays: number;
  lateCount: number;
  lateMinutes: number;
  lateAmMinutes: number;
  latePmMinutes: number;
  missingEntries: number;
  missingExits: number;
  unmarkedDays: number;
  unmarkedHalfDays: number;
  workedMinutes: number;
  justifiedDays: number;
  pendingIssueDays: number;
}

export interface EmployeeMonth {
  period: Period;
  employee: EmployeeSummary;
  days: DayResult[];
  totals: AttendanceTotals;
}

export interface SummaryRow {
  employee: EmployeeSummary;
  totals: AttendanceTotals;
}

export interface PeriodSummary {
  period: Period;
  rows: SummaryRow[];
}

export interface IssueRow {
  employee: EmployeeSummary;
  day: DayResult;
}

export interface AccumulatedRow {
  employee: EmployeeSummary;
  lateMinutesByPeriod: number[];
  totals: AttendanceTotals;
}

export interface Accumulated {
  periods: Period[];
  rows: AccumulatedRow[];
}

/** AdjustmentRequestDto: horas en "HH:mm" o vacío. */
export interface AdjustmentRequest {
  overrideMarks: boolean;
  entryAm: string | null;
  exitAm: string | null;
  entryPm: string | null;
  exitPm: string | null;
  justificationType: string | null;
  excuseLateAm: boolean;
  excuseLatePm: boolean;
  excuseMissing: boolean;
  reason: string;
}

export interface ImportResult {
  attendanceImportId: number;
  fileName: string;
  firstDate: string;
  lastDate: string;
  employeeCount: number;
  dayCount: number;
  markCount: number;
  newEmployees: string[];
  renamedEmployees: string[];
  periods: Period[];
  warnings: string[];
}

export interface AttendanceImport {
  attendanceImportId: number;
  fileName: string;
  firstDate: string;
  lastDate: string;
  employeeCount: number;
  newEmployeeCount: number;
  dayCount: number;
  markCount: number;
  importedByName: string | null;
  importedAt: string;
}

export interface Employee {
  employeeId: number;
  deviceCode: string;
  fullName: string;
  deviceName: string;
  workGroupId: number | null;
  workGroupName: string | null;
  includeInReports: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeRequest {
  fullName: string;
  workGroupId: number | null;
  includeInReports: boolean;
  isActive: boolean;
}

export interface WorkGroup {
  workGroupId: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  employeeCount: number;
}

export interface Holiday {
  holidayId: number;
  date: string;
  name: string;
}

export interface PeriodRequest {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

export interface WorkScheduleDay {
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  endTime: string | null;
}

export interface AttendanceSettings {
  toleranceMinutes: number;
  duplicateWindowMinutes: number;
  minBreakMinutes: number;
  middayFrom: string;
  afternoonExitFrom: string;
  earliestNormalTime: string;
  latestNormalTime: string;
  periodCutoffDay: number;
  schedules: WorkScheduleDay[];
}

/** JustificationTypes del backend. */
export const JUSTIFICATION_TYPES = ['PERMISO', 'COMISION', 'BAJA_MEDICA', 'VACACION', 'OLVIDO_MARCAR', 'FALLA_BIOMETRICO', 'OTRO'] as const;

export type ReportFormat = 'Pdf' | 'Excel';
