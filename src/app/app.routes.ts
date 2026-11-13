import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';
import { ROLES } from './core/auth/auth.models';

const placeholder = () => import('./features/placeholder/placeholder-page').then((m) => m.PlaceholderPage);

/** Opciones del menú que todavía muestran la pantalla provisional (se reemplazan una por una). */
const MENU_ROUTES: { path: string; titleKey: string; icon: string }[] = [
];

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    // Pantalla de prueba del sistema de estilos: muestra los colores de src/styles/theme.scss
    // en todos los componentes, en claro y en oscuro.
    path: 'style-guide',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        // Provisional hasta que exista el dashboard de ClockMetrics.
        path: '',
        pathMatch: 'full',
        loadComponent: placeholder,
        data: { titleKey: 'nav.home' },
      },
      {
        path: 'attendance/import',
        canActivate: [roleGuard(ROLES.admin, ROLES.humanResources)],
        loadComponent: () => import('./features/attendance/import-page/import-page').then((m) => m.ImportPage),
      },
      {
        path: 'attendance/employee',
        loadComponent: () => import('./features/attendance/employee-month/employee-month').then((m) => m.EmployeeMonth),
      },
      {
        path: 'attendance/issues',
        loadComponent: () => import('./features/attendance/issues-page/issues-page').then((m) => m.IssuesPage),
      },
      {
        path: 'reports/month-summary',
        loadComponent: () => import('./features/attendance/month-summary/month-summary').then((m) => m.MonthSummary),
      },
      {
        path: 'reports/accumulated',
        loadComponent: () => import('./features/attendance/accumulated/accumulated').then((m) => m.Accumulated),
      },
      {
        path: 'catalogs/employees',
        loadComponent: () => import('./features/attendance/catalogs/employees').then((m) => m.EmployeesList),
      },
      {
        path: 'catalogs/work-groups',
        loadComponent: () => import('./features/attendance/catalogs/work-groups').then((m) => m.WorkGroupsList),
      },
      {
        path: 'catalogs/holidays',
        loadComponent: () => import('./features/attendance/catalogs/holidays').then((m) => m.HolidaysList),
      },
      {
        path: 'catalogs/periods',
        loadComponent: () => import('./features/attendance/catalogs/periods').then((m) => m.PeriodsList),
      },
      {
        path: 'catalogs/settings',
        loadComponent: () => import('./features/attendance/catalogs/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard(ROLES.admin)],
        loadComponent: () => import('./features/admin/users/users-list/users-list').then((m) => m.UsersList),
      },
      {
        path: 'admin/roles',
        canActivate: [roleGuard(ROLES.admin)],
        loadComponent: () => import('./features/admin/roles/roles-list/roles-list').then((m) => m.RolesList),
      },
      {
        path: 'admin/audit-logs',
        canActivate: [roleGuard(ROLES.admin, ROLES.humanResources)],
        loadComponent: () => import('./features/admin/audit-logs/audit-logs-list/audit-logs-list').then((m) => m.AuditLogsList),
      },
      ...MENU_ROUTES.map(({ path, titleKey, icon }) => ({
        path,
        pathMatch: 'full' as const,
        loadComponent: placeholder,
        data: { titleKey, icon },
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
