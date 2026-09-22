import { textMentionsModel } from '../catalog/clasificar-filas';
import { detectBrand } from './vehicle-brand';
import { InterestedCarSnapshot } from '../persistence/lead.types';

const SIGUE_ESE =
  /\b(?:este|esta|eso|ese|mismo|simulaci\w*|cuotas?|cr[eé]ditos?|entradas?|financi\w*|meses)\b/i;

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

export function formatInterestedCar(car: InterestedCarSnapshot): string {
  const price = car.price && car.price > 0 ? `, $${Math.round(car.price)}` : '';
  const year = car.year ? ` ${car.year}` : '';
  return `VEHÍCULO DE INTERÉS (interested_cars, el último que pidió)
${car.brand} ${car.model}${year}${price}
inventory_id=${car.inventoryId}
Si habla de este vehículo, de la simulación, la cuota o el crédito, usa este precio. No vuelvas a pedir marca ni modelo.`;
}
