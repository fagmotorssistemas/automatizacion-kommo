import { isVacanteAsesorComercial } from './is-vacante-asesor';
import { isVacanteDesarrollador } from './is-vacante-desarrollador';
import { VACANTE_ETIQUETA, VACANTE_ETIQUETA_DESARROLLADOR } from './vacante.constants';

/**
 * Etiqueta de Kommo de la vacante que abre este mensaje, o null si es de
 * ventas. Todas las vacantes van por el mismo camino (misma fila `vacante`,
 * mismo responsable); solo cambia la etiqueta. Sin modelo.
 */
export function detectVacanteEtiqueta(text: string): string | null {
  if (isVacanteAsesorComercial(text)) {
    return VACANTE_ETIQUETA;
  }
  if (isVacanteDesarrollador(text)) {
    return VACANTE_ETIQUETA_DESARROLLADOR;
  }
  return null;
}
