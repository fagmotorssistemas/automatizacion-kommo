const SELLING_INTENTS = new Set(['venta', 'tomavehicular', 'intercambio']);
const BUYING_INTENTS = new Set([
  'compra',
  'busqueda',
  'consultamodelo',
  'presentacionopciones',
  'vehiculossimilares',
]);

const RESUMEN_VENDE =
  /vendernos su\b|quiere vender su\b|parte de pago|intercambiar su\b/i;
const RESUMEN_COMPRA_OTRO =
  /quiere comprar otro|quiere ver (?:un|una|el|la)\b/i;

/** El resumen o el clasificador dicen que el carro es de él y nos lo vende. */
export function turnIsSellingTheirCar(
  promptNames: string[],
  resumen: string,
): boolean {
  return (
    promptNames.some((name) => SELLING_INTENTS.has(name)) ||
    RESUMEN_VENDE.test(resumen)
  );
}

/**
 * Quiere comprar otro carro nuestro, distinto del que vende.
 * Si el resumen solo habla de vendernos el suyo, un "compra" suelto no cuenta.
 */
export function turnAlsoWantsToBuy(
  promptNames: string[],
  resumen: string,
): boolean {
  const resumenBuys = RESUMEN_COMPRA_OTRO.test(resumen);
  if (RESUMEN_VENDE.test(resumen) && !resumenBuys) {
    return false;
  }
  return (
    resumenBuys || promptNames.some((name) => BUYING_INTENTS.has(name))
  );
}

export const SU_CARRO_NO_SE_OFRECE = `TOMA: el cliente nos está vendiendo SU vehículo. Nosotros se lo vamos a comprar. Pide solo los datos que falten de ESE carro (marca, modelo, año, km, color, primera letra de la placa, fotos y monto esperado). No inventes el valor: lo define el avalúo.
Prohibido buscar u ofrecer un carro igual o parecido al que nos vende. No digas que tenemos ese modelo.
Si además quiere comprar OTRO carro nuestro, ese otro sí se puede buscar. El suyo no.`;
