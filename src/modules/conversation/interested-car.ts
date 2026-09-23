import { modelFamily } from '../catalog/clasificar-filas';
import { detectVehicleKind, kindFromTypeBody } from './vehicle-kind';
import { detectBrand, detectNamedModelAsk } from './vehicle-brand';
import { detectGearbox, gearboxOf } from './gearbox';
import { InterestedCarSnapshot } from '../persistence/lead.types';

export type ShownCarContext = {
  text: string;
  resumen?: string | null;
  history?: { role: string; content: string }[];
  car: InterestedCarSnapshot | null;
};

function namedOtherUnit(text: string, car: InterestedCarSnapshot): boolean {
  const asked = detectNamedModelAsk(text);
  if (!asked) {
    return false;
  }
  if (asked.family !== modelFamily(car.model)) {
    return true;
  }
  return Boolean(asked.year && car.year && asked.year !== car.year);
}

/** El cliente dejó el hilo de la unidad mostrada (otro modelo/marca/caja/tipo/año). */
export function leftShownCar(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  if (namedOtherUnit(input.text, car)) {
    return true;
  }
  if (input.resumen && namedOtherUnit(input.resumen, car)) {
    return true;
  }
  const otherBrand = detectBrand(input.text);
  if (
    otherBrand &&
    otherBrand !== car.brand.trim().toLowerCase() &&
    detectNamedModelAsk(input.text)?.brand !== car.brand.trim().toLowerCase()
  ) {
    return true;
  }
  const box = detectGearbox(input.text);
  const shownBox = gearboxOf(car);
  if (box && shownBox && box !== shownBox) {
    return true;
  }
  const saidKind = detectVehicleKind(input.text);
  const shownKind = kindFromTypeBody(car.typeBody);
  if (saidKind && shownKind && saidKind !== shownKind) {
    return true;
  }
  return false;
}

/** El mensaje habla del último carro pedido, no de uno nuevo. */
export function refersToInterestedCar(
  text: string,
  car: InterestedCarSnapshot,
): boolean {
  return followsShownCar({ text, car });
}

/**
 * El hilo sigue en la unidad que ya mostramos.
 * No depende de frases fijas: se mira el mensaje, el resumen y el último turno.
 * Solo se suelta si el cliente se fue a otro carro.
 */
export function followsShownCar(input: ShownCarContext): boolean {
  if (!input.car) {
    return false;
  }
  return !leftShownCar(input);
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
  const tipo = kindFromTypeBody(car.typeBody);
  const tipoLine = tipo
    ? `\nTipo de este carro: ${tipo}. Sigue con este tipo salvo que nombre un modelo de otro tipo.`
    : '';
  const facts = [
    car.mileage != null && car.mileage >= 0 ? `km=${Math.round(car.mileage)}` : '',
    car.color ? `color=${car.color}` : '',
    car.transmission ? `caja=${car.transmission}` : '',
    car.plateShort ? `plate_short=${car.plateShort}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const factsLine = facts
    ? `\n${facts}
Estos datos son para responder si el resumen o el mensaje los piden. Placa solo en la primera presentación o si la preguntó.`
    : '';
  return `VEHÍCULO DE INTERÉS (interested_cars, el último que pidió)
${car.brand} ${car.model}${year}${shown}
inventory_id=${car.inventoryId}${interno}${tipoLine}${factsLine}
El resumen y el historial dicen cómo sigue el hilo: si no cambió de carro, sigue ESTA unidad. No reabras inventario. No vuelvas a pedir marca ni modelo.`;
}
