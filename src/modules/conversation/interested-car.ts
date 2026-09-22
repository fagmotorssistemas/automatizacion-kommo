import { textMentionsModel } from '../catalog/clasificar-filas';
import { detectBrand } from './vehicle-brand';
import { InterestedCarSnapshot } from '../persistence/lead.types';

const SIGUE_ESE =
  /\b(?:este|esta|eso|ese|mismo|simulaci\w*|cuotas?|cr[eé]ditos?|entradas?|financi\w*|meses|precios?|cuesta|vale)\b/i;

/** El mensaje habla del último carro pedido, no de uno nuevo. */
export function refersToInterestedCar(
  text: string,
  car: InterestedCarSnapshot,
): boolean {
  const otherBrand = detectBrand(text);
  if (otherBrand && otherBrand !== car.brand.trim().toLowerCase()) {
    return false;
  }
  if (textMentionsModel(text, car.model)) {
    return true;
  }
  return SIGUE_ESE.test(text);
}

export function formatInterestedCar(
  car: InterestedCarSnapshot,
  includePrice = false,
): string {
  const year = car.year ? ` ${car.year}` : '';
  const shown =
    includePrice && car.price && car.price > 0
      ? `, $${Math.round(car.price)}`
      : '';
  const interno =
    !includePrice && car.price && car.price > 0
      ? `\nprecio_interno=${Math.round(car.price)} (solo para la herramienta de financiamiento. No lo escribas en respuesta_cliente.)`
      : '';
  return `VEHÍCULO DE INTERÉS (interested_cars, el último que pidió)
${car.brand} ${car.model}${year}${shown}
inventory_id=${car.inventoryId}${interno}
Si habla de este vehículo, de la simulación, la cuota o el crédito, usa este inventario. No vuelvas a pedir marca ni modelo.`;
}
