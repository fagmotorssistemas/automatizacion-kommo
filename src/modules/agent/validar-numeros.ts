import { prettyFamily } from '../catalog/clasificar-filas';
import { isUuid } from '../persistence/is-uuid';

export type HechoUnidad = {
  id: string;
  label: string;
  km: number | null;
  precio: number | null;
};

export type NumeroExtraido = {
  tipo: 'km' | 'precio';
  valor: number;
  crudo: string;
  inicio: number;
  fin: number;
};

export type CorreccionNumero = {
  tipo: 'km' | 'precio';
  dijo: number;
  correcto: number | null;
  id: string | null;
};

export type ValidarNumerosResult = {
  texto: string;
  correcciones: CorreccionNumero[];
  requiereRegenerar: boolean;
};

/** Mensajes del cliente y el resumen del turno, para no corregir km que no son de la unidad. */
export type ContextoNumeros = {
  history?: { role: string; content: string }[];
  resumen?: string;
};

export type InventoryFactRow = {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  mileage: number | null;
  price: number | null;
};

const FINANCIERO = new Set([
  'cuota',
  'entrada',
  'mensual',
  'mensuales',
  'financ',
  'plazo',
  'meses',
  'interes',
  'abono',
  'descuento',
  'ahorro',
  'diferencia',
  'seguro',
  'gastos',
]);

const NUM_RE = /\d{1,3}(?:[.\s,]\d{3})+|\d+/g;
const KM_AFTER =
  /^(?:\s+\S+){0,2}\s*(?:km|kms|kil[oó]metros?|kilometraje)\b/i;
const DOLAR_AFTER = /^\s*(?:d[oó]lares|usd)\b/i;

function foldWord(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function esFinanciero(word: string): boolean {
  const folded = foldWord(word);
  if (!folded) {
    return false;
  }
  if (FINANCIERO.has(folded)) {
    return true;
  }
  return folded.startsWith('financ');
}

function palabrasAlrededor(
  texto: string,
  inicio: number,
  fin: number,
): { antes: string[]; despues: string[] } {
  const antes = texto
    .slice(0, inicio)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-6);
  const despues = texto
    .slice(fin)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return { antes, despues };
}

function parseValor(crudo: string): number | null {
  const compact = crudo.replace(/[.\s,]/g, '');
  if (!compact) {
    return null;
  }
  const valor = Number(compact);
  return Number.isFinite(valor) ? valor : null;
}

function foldPlain(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function fraseDe(texto: string, index: number): string {
  let start = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = texto[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') {
      start = i + 1;
      break;
    }
  }
  let end = texto.length;
  for (let i = index; i < texto.length; i += 1) {
    const ch = texto[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') {
      end = i;
      break;
    }
  }
  return texto.slice(start, end);
}

/** Km de uso anual o de una garantía: no es el kilometraje de la unidad. */
function kmExentoPorTexto(texto: string, inicio: number, fin: number): boolean {
  const after = texto.slice(fin);
  const km = after.match(KM_AFTER);
  if (km) {
    const rest = foldPlain(after.slice(km[0].length));
    if (/^\s*(?:al ano|por ano|\/\s*ano|anuales?)\b/.test(rest)) {
      return true;
    }
  }
  return /garantia/.test(foldPlain(fraseDe(texto, inicio)));
}

function valoresEn(texto: string): Set<number> {
  const valores = new Set<number>();
  for (const match of texto.matchAll(NUM_RE)) {
    const valor = parseValor(match[0]);
    if (valor != null) {
      valores.add(valor);
    }
  }
  return valores;
}

function numerosDelCliente(ctx?: ContextoNumeros): Set<number> {
  const valores = new Set<number>();
  for (const msg of ctx?.history ?? []) {
    if (msg.role !== 'user') {
      continue;
    }
    for (const valor of valoresEn(msg.content)) {
      valores.add(valor);
    }
  }
  return valores;
}

function numerosDeToma(resumen?: string): Set<number> {
  if (!resumen) {
    return new Set();
  }
  const lines = resumen.split('\n');
  const chunks: string[] = [];
  let on = false;
  for (const line of lines) {
    if (/^\s*Toma\s+(?:ficha|ya)\b/i.test(line)) {
      on = true;
      chunks.push(line);
      continue;
    }
    if (on && /^\s*\S[^:]{0,40}:/.test(line)) {
      on = false;
    }
    if (on) {
      chunks.push(line);
    }
  }
  return valoresEn(chunks.join('\n'));
}

function kmExento(
  texto: string,
  num: NumeroExtraido,
  ctx?: ContextoNumeros,
): boolean {
  if (num.tipo !== 'km') {
    return false;
  }
  if (kmExentoPorTexto(texto, num.inicio, num.fin)) {
    return true;
  }
  if (numerosDelCliente(ctx).has(num.valor)) {
    return true;
  }
  return numerosDeToma(ctx?.resumen).has(num.valor);
}

function detectaSeparador(crudo: string): '.' | ',' | ' ' | null {
  if (/\d\.\d{3}/.test(crudo)) {
    return '.';
  }
  if (/\d,\d{3}/.test(crudo)) {
    return ',';
  }
  if (/\d \d{3}/.test(crudo)) {
    return ' ';
  }
  return null;
}

export function formatMilesComo(valor: number, crudo: string): string {
  const sep = detectaSeparador(crudo) ?? '.';
  return String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function extraerNumeros(texto: string): NumeroExtraido[] {
  const found: NumeroExtraido[] = [];
  const seen = new Set<string>();
  for (const match of texto.matchAll(NUM_RE)) {
    const crudo = match[0];
    const inicio = match.index ?? 0;
    const fin = inicio + crudo.length;
    const valor = parseValor(crudo);
    if (valor == null) {
      continue;
    }
    const after = texto.slice(fin);
    const before = texto.slice(0, inicio);
    const esKm = KM_AFTER.test(after);
    const dolarAntes = /\$\s*$/.test(before);
    const dolarDespues = DOLAR_AFTER.test(after);
    let tipo: 'km' | 'precio' | null = null;
    if (esKm) {
      tipo = 'km';
    } else if (dolarAntes || dolarDespues) {
      const { antes, despues } = palabrasAlrededor(texto, inicio, fin);
      if (![...antes, ...despues].some(esFinanciero)) {
        tipo = 'precio';
      }
    }
    if (!tipo) {
      continue;
    }
    if (tipo === 'km' && kmExentoPorTexto(texto, inicio, fin)) {
      continue;
    }
    const key = `${tipo}:${inicio}:${fin}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    found.push({ tipo, valor, crudo, inicio, fin });
  }
  return found;
}

export function unidadReferencia(
  hechos: HechoUnidad[],
  metaInventoryId: string | null,
): HechoUnidad | null {
  if (metaInventoryId) {
    const hit = hechos.find((row) => row.id === metaInventoryId);
    if (hit) {
      return hit;
    }
  }
  return hechos.length === 1 ? hechos[0] : null;
}

function valorDe(hecho: HechoUnidad, tipo: 'km' | 'precio'): number | null {
  return tipo === 'km' ? hecho.km : hecho.precio;
}

function coincideHechos(num: NumeroExtraido, hechos: HechoUnidad[]): boolean {
  return hechos.some((hecho) => valorDe(hecho, num.tipo) === num.valor);
}

export function numerosInvalidos(
  texto: string,
  hechos: HechoUnidad[],
  ctx?: ContextoNumeros,
): NumeroExtraido[] {
  return extraerNumeros(texto).filter(
    (num) => !kmExento(texto, num, ctx) && !coincideHechos(num, hechos),
  );
}

function stripAproxCerca(texto: string, numberEnd: number): string {
  const tail = texto.slice(numberEnd);
  const km = tail.match(KM_AFTER);
  if (!km) {
    return texto;
  }
  const afterKm = numberEnd + km[0].length;
  const rest = texto.slice(afterKm);
  const aprox = rest.match(/^\s+aproximad(?:os|amente)\b/i);
  if (!aprox) {
    return texto;
  }
  return `${texto.slice(0, afterKm)}${rest.slice(aprox[0].length)}`;
}

function reemplazarNumero(
  texto: string,
  num: NumeroExtraido,
  correcto: number,
): string {
  const nuevo = formatMilesComo(correcto, num.crudo);
  const next = `${texto.slice(0, num.inicio)}${nuevo}${texto.slice(num.fin)}`;
  const delta = nuevo.length - num.crudo.length;
  return stripAproxCerca(next, num.fin + delta);
}

export function quitarFragmentoInvalido(
  texto: string,
  num: NumeroExtraido,
): string {
  const escaped = num.crudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns =
    num.tipo === 'km'
      ? [
          new RegExp(`\\bcon\\s+${escaped}\\s+kms?\\b`, 'i'),
          new RegExp(`\\b${escaped}\\s+kms?\\b`, 'i'),
        ]
      : [
          new RegExp(`\\bde\\s+\\$?\\s*${escaped}\\b`, 'i'),
          new RegExp(`\\ben\\s+\\$?\\s*${escaped}\\b`, 'i'),
          new RegExp(`\\$\\s*${escaped}`, 'i'),
        ];
  for (const pattern of patterns) {
    if (pattern.test(texto)) {
      return texto.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return `${texto.slice(0, num.inicio)}${texto.slice(num.fin)}`
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function quitarKmEnIndice(texto: string, num: NumeroExtraido): string {
  const tail = texto.slice(num.fin);
  const km = tail.match(KM_AFTER);
  const end = km ? num.fin + km[0].length : num.fin;
  const before = texto.slice(0, num.inicio);
  const con = before.match(/\bcon\s+$/i);
  const start = con ? before.length - con[0].length : num.inicio;
  return `${texto.slice(0, start)}${texto.slice(end)}`;
}

export function validarNumeros(
  respuesta: string,
  hechos: HechoUnidad[],
  metaInventoryId: string | null,
  ctx?: ContextoNumeros,
): ValidarNumerosResult {
  const numeros = extraerNumeros(respuesta);
  const ref = unidadReferencia(hechos, metaInventoryId);
  const correcciones: CorreccionNumero[] = [];
  let texto = respuesta;
  let requiereRegenerar = false;
  const invalidos = numeros.filter(
    (num) => !kmExento(respuesta, num, ctx) && !coincideHechos(num, hechos),
  );
  if (invalidos.length === 0) {
    return { texto, correcciones, requiereRegenerar: false };
  }
  if (!ref) {
    return { texto, correcciones, requiereRegenerar: true };
  }
  for (const num of [...invalidos].sort((a, b) => b.inicio - a.inicio)) {
    const correcto = valorDe(ref, num.tipo);
    correcciones.push({
      tipo: num.tipo,
      dijo: num.valor,
      correcto,
      id: ref.id,
    });
    if (num.tipo === 'km' && ref.km == null) {
      texto = quitarKmEnIndice(texto, num);
      continue;
    }
    if (correcto == null) {
      requiereRegenerar = true;
      continue;
    }
    texto = reemplazarNumero(texto, num, correcto);
  }
  return {
    texto: texto.replace(/\s{2,}/g, ' ').trim(),
    correcciones,
    requiereRegenerar,
  };
}

export function quitarInvalidosSinRef(
  respuesta: string,
  hechos: HechoUnidad[],
  ctx?: ContextoNumeros,
): { texto: string; correcciones: CorreccionNumero[] } {
  let texto = respuesta;
  const correcciones: CorreccionNumero[] = [];
  for (const num of [...extraerNumeros(texto)].reverse()) {
    if (kmExento(texto, num, ctx) || coincideHechos(num, hechos)) {
      continue;
    }
    correcciones.push({
      tipo: num.tipo,
      dijo: num.valor,
      correcto: null,
      id: null,
    });
    texto = quitarFragmentoInvalido(texto, num);
  }
  return { texto: texto.replace(/\s{2,}/g, ' ').trim(), correcciones };
}

export function labelHecho(row: InventoryFactRow): string {
  const family = prettyFamily(row.model) || row.model;
  const year = row.year ? ` ${row.year}` : '';
  const color = row.color ? ` ${row.color}` : '';
  return `${row.brand} ${family}${year}${color}`.replace(/\s+/g, ' ').trim();
}

export function hechoDesdeFila(row: InventoryFactRow): HechoUnidad {
  const km =
    row.mileage != null && Number.isFinite(row.mileage) && row.mileage > 0
      ? Math.round(row.mileage)
      : null;
  const precio =
    row.price != null && Number.isFinite(row.price) && row.price > 0
      ? Math.round(row.price)
      : null;
  return { id: row.id, label: labelHecho(row), km, precio };
}

export function reunirInventoryIds(input: {
  metaId?: string | null;
  interestedId?: string | null;
  sendId?: string | null;
  listedIds?: string[];
  photoIds?: string[];
  toolIds?: string[];
  revisionText?: string;
}): string[] {
  const raw = [
    input.metaId,
    input.interestedId,
    input.sendId,
    ...(input.listedIds ?? []),
    ...(input.photoIds ?? []),
    ...(input.toolIds ?? []),
  ];
  if (input.revisionText) {
    const uuids = input.revisionText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    );
    raw.push(...(uuids ?? []));
  }
  return [...new Set(raw.filter((id): id is string => Boolean(id && isUuid(id))))];
}

export function idsDesdeToolJson(raw: string): string[] {
  const uuids = raw.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  );
  return [...new Set((uuids ?? []).filter((id) => isUuid(id)))];
}

export async function intentarCargarHechos(
  cargar: () => Promise<HechoUnidad[]>,
): Promise<{ hechos: HechoUnidad[]; error?: string }> {
  try {
    return { hechos: await cargar() };
  } catch (error) {
    return {
      hechos: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatNumerosLog(input: {
  contactId: string;
  revisados: number;
  invalidos: number;
  corregidos: number;
  regenerado: boolean;
  detalle: CorreccionNumero[];
  error?: string;
}): string {
  const detalle = JSON.stringify(input.detalle);
  const error = input.error ? ` error=${input.error}` : '';
  return `numeros contactId=${input.contactId} revisados=${input.revisados} invalidos=${input.invalidos} corregidos=${input.corregidos} regenerado=${input.regenerado} detalle=${detalle}${error}`;
}

export function formatHechosParaRegen(hechos: HechoUnidad[]): string {
  return hechos
    .map((hecho) => {
      const km = hecho.km != null ? `km=${hecho.km}` : 'km=aún no cargado';
      const precio =
        hecho.precio != null ? `precio=${hecho.precio}` : 'precio=aún no cargado';
      return `${hecho.label}: ${km}, ${precio}`;
    })
    .join('; ');
}

export function formatInvalidosParaRegen(numeros: NumeroExtraido[]): string {
  return numeros.map((num) => `${num.tipo}=${num.crudo}`).join(', ');
}
