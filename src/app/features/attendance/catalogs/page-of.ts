import { PagedResult } from '../../../core/http/api.models';

/** Pagina en el navegador un catálogo chico que el backend devuelve completo (grupos, feriados, períodos). */
export function pageOf<T>(items: T[], pageNumber: number, pageSize: number): PagedResult<T> {
  return {
    items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    totalRecords: items.length,
    pageNumber,
    pageSize,
  };
}
