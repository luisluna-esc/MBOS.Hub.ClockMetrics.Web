# ClockMetrics (frontend)

Angular 20 + Tailwind 4. Sale de la base común de FundTrack: login con refresh token, layout con
menú por rol, administración (usuarios, roles, auditoría), tema claro/oscuro, i18n (es/en/pt),
atajos de teclado y los componentes de `shared/`. El backend está en `MBOS.Hub.ClockMetrics`.

```bash
npm install
npm start          # http://localhost:4200, apunta al backend en http://localhost:5152/api
npm run build      # producción: /api lo resuelve nginx (nginx.conf)
```

Se entra con `admin.mbos` / `mbos12345` (ver `Scripts/seedData.sql` del backend).

## Dónde va cada cosa

| Carpeta | Qué tiene |
|---|---|
| `src/app/core` | Sesión, interceptor, `ApiService`, menú, tema, i18n, toasts, diálogos, atajos |
| `src/app/shared` | Componentes (tabla, filtros, inputs, diálogos, gráficas...), `ListPage` y `FormDialog` |
| `src/app/layout/shell` | Barra lateral y encabezado |
| `src/app/features` | Pantallas: `attendance` (importar, registro por empleado, incoherencias, reportes, catálogos), `auth`, `admin`, `placeholder`, `style-guide` |
| `src/styles/theme.scss` | Único lugar de los colores (tokens) |
| `public/i18n` | Textos en es, en y pt |

## Agregar una pantalla de lista

El modelo es `features/admin/roles`: una lista que extiende `ListPage<T>` (usa la plantilla
`shared/list-page/list-page.html`) y un diálogo que extiende `FormDialog`. Después:

1. La ruta en `app.routes.ts`.
2. El menú en el backend (`menu` y `menu_role`); el texto sale de `translation_key` (ej. `nav.xxx`).
3. Los textos en los tres archivos de `public/i18n`.

## Pendiente

- Logo propio: por ahora se usan los de MBOS (`public/img/MBOS-*.png`) en login, barra lateral y
  guía de estilos.
- El dashboard: Inicio muestra la pantalla provisional.
- El despliegue: hay Dockerfile y nginx.conf, pero falta elegir puertos en el servidor.
