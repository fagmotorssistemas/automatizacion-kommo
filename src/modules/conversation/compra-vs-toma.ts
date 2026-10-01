import {
  resumenCajaCompra,
  resumenCabina,
  resumenColorPedido,
  resumenEsToma,
  resumenOtroVehiculo,
  resumenQuiereComprar,
  resumenSuCarro,
  resumenTipoPatio,
  resumenTomaFicha,
  resumenTraccionPedida,
  solicitudSinBanderas,
} from '../intelligence/parse-resumen';
import type { NamedModelAsk, VehicleLexicon } from './vehicle-brand';
import { detectNamedModelAsk } from './vehicle-brand';
import {
  damerauLevenshtein,
  evidenciaReal,
  tokensDe,
  type TextosBot,
} from './otro-vehiculo';
import { parseTomaChecklistFromResumen } from './toma-checklist';
import { colorMatches } from './vehicle-brand';
import {
  rowMentionsFamily,
  type StockCar,
} from '../catalog/clasificar-filas';

function distinctiveTokens(valor: string): string[] {
  return tokensDe(valor).filter(
    (token) => token !== 'no' && (token.length >= 2 || /^\d+$/.test(token)),
  );
}

function tokenCubre(token: string, pool: string[]): boolean {
  if (pool.includes(token)) {
    return true;
  }
  if (token.length < 4 || !/^[a-z]+$/.test(token)) {
    return false;
  }
  return pool.some(
    (item) =>
      item.length >= 4 &&
      /^[a-z]+$/.test(item) &&
      damerauLevenshtein(token, item) <= 1,
  );
}

/** Misma unidad: tokens con tolerancia de una letra. */
export function mismoVehiculoPorTokens(a: string, b: string): boolean {
  const left = distinctiveTokens(a);
  const right = distinctiveTokens(b);
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.every((token) => tokenCubre(token, longer));
}

export function otroVehiculoEfectivo(resumen: string): string | null {
  const otro = resumenOtroVehiculo(resumen);
  if (!otro) {
    return null;
  }
  const suyo = resumenSuCarro(resumen) ?? resumenTomaFicha(resumen);
  if (suyo && mismoVehiculoPorTokens(otro, suyo)) {
    return null;
  }
  return otro;
}

function blobToma(resumen: string): string {
  const parsed = parseTomaChecklistFromResumen(resumen);
  const have = parsed
    ? Object.values(parsed.have).filter(Boolean).join(' ')
    : '';
  return [resumenSuCarro(resumen), resumenTomaFicha(resumen), have]
    .filter(Boolean)
    .join(' ');
}

export type BanderaDeToma =
  | 'color'
  | 'caja'
  | 'tipo'
  | 'traccion'
  | 'cabina';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function valorJuntoAlPedido(
  customerText: string,
  quiere: string | null,
  valor: string,
): boolean {
  if (!quiere) {
    return false;
  }
  const n = fold(customerText);
  const v = fold(valor);
  if (!n.includes(v)) {
    return false;
  }
  const idx = n.indexOf(v);
  const window = n.slice(Math.max(0, idx - 28), idx + v.length + 28);
  if (/\bmi\b|\btengo\b|\bel mio\b/.test(window)) {
    return false;
  }
  return distinctiveTokens(quiere).some((token) =>
    tokenCubre(token, tokensDe(window)),
  );
}

function evidenciaPedidoDeEsaBandera(
  resumen: string,
  customerText: string,
  valor: string,
): boolean {
  const quiere = resumenQuiereComprar(resumen);
  if (quiere && fold(quiere).includes(fold(valor))) {
    return true;
  }
  return valorJuntoAlPedido(customerText, quiere, valor);
}

/**
 * Banderas de compra cuyo valor es el del carro SUYO, sin evidencia de
 * pedido de patio con ese dato.
 */
export function banderasCompraQueSonDeToma(input: {
  resumen: string;
  customerText: string;
  lastAssistantText: TextosBot;
}): BanderaDeToma[] {
  const toma = blobToma(input.resumen);
  if (!toma && !resumenEsToma(input.resumen)) {
    return [];
  }
  const ignored: BanderaDeToma[] = [];
  const color = resumenColorPedido(input.resumen);
  if (
    color &&
    (colorMatches(toma, color) ||
      fold(toma).includes(fold(color)) ||
      (resumenEsToma(input.resumen) &&
        fold(input.customerText).includes(fold(color)))) &&
    !evidenciaPedidoDeEsaBandera(input.resumen, input.customerText, color)
  ) {
    ignored.push('color');
  }
  const caja = resumenCajaCompra(input.resumen);
  if (
    caja &&
    caja !== 'no' &&
    fold(toma).includes(caja === 'manual' ? 'manual' : 'automatic') &&
    !evidenciaPedidoDeEsaBandera(input.resumen, input.customerText, caja)
  ) {
    ignored.push('caja');
  }
  const tipo = resumenTipoPatio(input.resumen);
  if (
    tipo &&
    tipo !== 'no' &&
    fold(toma).includes(fold(tipo)) &&
    !evidenciaPedidoDeEsaBandera(input.resumen, input.customerText, tipo)
  ) {
    ignored.push('tipo');
  }
  const traccion = resumenTraccionPedida(input.resumen);
  if (
    traccion &&
    traccion !== 'no' &&
    fold(toma).includes(fold(traccion).replace('x', '')) &&
    !evidenciaPedidoDeEsaBandera(input.resumen, input.customerText, traccion)
  ) {
    ignored.push('traccion');
  }
  const cabina = resumenCabina(input.resumen);
  if (
    cabina &&
    (fold(toma).includes(cabina === 'cs' ? 'simple' : 'doble') ||
      fold(toma).includes(cabina)) &&
    !evidenciaPedidoDeEsaBandera(input.resumen, input.customerText, cabina)
  ) {
    ignored.push('cabina');
  }
  return ignored;
}

function askEsSuCarro(ask: NamedModelAsk, suyo: string | null): boolean {
  if (!suyo) {
    return false;
  }
  return mismoVehiculoPorTokens(
    `${ask.brand} ${ask.family} ${ask.year ?? ''}`.trim(),
    suyo,
  );
}

/**
 * Modelo de patio de este turno. "Quiere comprar" gana si hay evidencia.
 * lastModelHit solo respaldo, y nunca elige Su carro.
 */
export function detectPedidoPatio(input: {
  resumen: string;
  customerText: string;
  lastAssistantText: TextosBot;
  lexicon: VehicleLexicon;
}): NamedModelAsk | null {
  const suyo = resumenSuCarro(input.resumen) ?? resumenTomaFicha(input.resumen);
  const quiere = resumenQuiereComprar(input.resumen);
  if (
    quiere &&
    evidenciaReal(quiere, input.customerText, input.lastAssistantText)
  ) {
    const asked = detectNamedModelAsk(quiere, input.lexicon);
    if (asked && !askEsSuCarro(asked, suyo)) {
      return asked;
    }
  }
  const blob = `${solicitudSinBanderas(input.resumen)}\n${input.customerText}`;
  const fallback = detectNamedModelAsk(blob, input.lexicon);
  if (!fallback || askEsSuCarro(fallback, suyo)) {
    return null;
  }
  return fallback;
}

export function textoPedidoPatio(ask: NamedModelAsk | null): string {
  if (!ask) {
    return '';
  }
  return [ask.brand, ask.family, ask.year].filter(Boolean).join(' ').trim();
}

/**
 * La unidad de "Quiere comprar" que se presentó: sendId de esa familia,
 * o la única de esa familia entre las mostradas (ficha o herramienta).
 */
export function unidadAAnclar(input: {
  family: string | null | undefined;
  sendId: string | null | undefined;
  presented: StockCar[];
}): string | null {
  const family = (input.family ?? '').trim();
  const ofFamily = family
    ? input.presented.filter((car) => rowMentionsFamily(car.model, family))
    : [];
  const sendId = input.sendId?.trim() || null;
  if (sendId && (!family || ofFamily.some((car) => car.id === sendId))) {
    return sendId;
  }
  if (ofFamily.length === 1) {
    return ofFamily[0].id;
  }
  return null;
}
