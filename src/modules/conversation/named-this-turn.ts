import {
  solicitudSinBanderas,
  resumenStaysOnShownUnit,
  vehicleClientePidio,
} from '../intelligence/parse-resumen';
import type { VehicleLexicon } from './fuzzy-vehicle-name';
import { detectBrand, detectBrands } from './vehicle-brand';

/**
 * Texto del cliente desde el que se lee la marca o el modelo que nombra ESTE turno.
 *
 * El buscador difuso puede leer una palabra común como un modelo («otra» de
 * «la otra semana» → Optra). Si el resumen dice que sigue en la unidad ya
 * mostrada (Pide otras: no) y no menciona esa marca, el analizador (que lee por
 * sentido) no vio a nadie nombrarla: no se cuenta. En cualquier otro caso el
 * texto queda como está.
 */
export function textoQueNombra(
  resumen: string,
  customerText: string,
  lexicon: VehicleLexicon,
): string {
  if (!resumen || !resumenStaysOnShownUnit(resumen)) {
    return customerText;
  }
  const said = detectBrand(customerText, lexicon);
  if (!said) {
    return customerText;
  }
  const understood = detectBrand(
    `${solicitudSinBanderas(resumen)}\n${vehicleClientePidio(resumen) ?? ''}`,
    lexicon,
  );
  return understood === said ? customerText : '';
}

/**
 * Las marcas que nombra el propio resumen (solicitud + vehículo) son todas la
 * del carro ya mostrado, o no nombra ninguna. Si nombra otra, cambió de carro.
 */
export function resumenBrandFitsShown(
  resumen: string,
  shownBrand: string | null | undefined,
  lexicon: VehicleLexicon,
): boolean {
  const shown = (shownBrand ?? '').trim().toLowerCase();
  // Cualquier marca distinta de la mostrada, no solo la última que aparezca.
  return detectBrands(
    `${solicitudSinBanderas(resumen)}\n${vehicleClientePidio(resumen) ?? ''}`,
    lexicon,
  ).every((brand) => brand === shown);
}
