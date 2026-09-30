import { InterestedCarSnapshot } from '../persistence/lead.types';
import { resumenOtroVehiculo } from '../intelligence/parse-resumen';
import {
  modelFamily,
  normalizeModelText,
  type StockCar,
} from '../catalog/clasificar-filas';
import { detectBrand, type VehicleLexicon } from './vehicle-brand';
import {
  askedOtherUnitFacts,
  listedPickStaysCore,
  shownLeavesByAsientos,
  shownLeavesByCabina,
  shownLeavesByCaja,
  shownLeavesByColor,
  shownLeavesByOtras,
  shownLeavesByTipo,
  shownLeavesByTope,
  shownLeavesByTraccion,
  type ShownCarContext,
} from './interested-car';

/** provisional, calibrar con logs */
export const MARGEN_RPC = 0.05;

export type StayFila1Decision = {
  stay: boolean;
  motivo: string;
  otroVehiculo: string | null;
  sospecha?: string | null;
  verificado?: string | null;
};

export function stayFieldsForRunLog(stay: StayFila1Decision | null): {
  stay: boolean | null;
  motivo: string | null;
  otroVehiculo: string | null;
  sospecha: string | null;
  verificado: string | null;
} {
  return {
    stay: stay?.stay ?? null,
    motivo: stay?.motivo ?? null,
    otroVehiculo: stay?.otroVehiculo ?? null,
    sospecha: stay?.sospecha ?? null,
    verificado: stay?.verificado ?? null,
  };
}

export type RpcOtroResult = {
  otroEsLaMostrada: boolean | null;
  rank1Id: string | null;
  sim1: number | null;
  sim2: number | null;
};

/** Un mensaje del bot, o varios. La evidencia usa como mucho los últimos 3. */
export type TextosBot = string | readonly string[];

export type Fila1NuevaInput = {
  resumen: string;
  customerText: string;
  lastAssistantText: TextosBot;
  car: InterestedCarSnapshot;
  otroEsLaMostrada: boolean | null;
  otroOverride?: string | null;
};

export type DecideStayNuevoInput = ShownCarContext & {
  lastListed?: boolean;
  lastOfferText?: string;
  lastAssistantText?: TextosBot;
  otroEsLaMostrada?: boolean | null;
  otroOverride?: string | null;
};

/** Familias del patio: se refresca sola, no se consulta en cada turno. */
export const PATIO_FAMILIES_TTL_MS = 3 * 60 * 1000;

export const VERIF_OTRO_TIMEOUT_MS = 4_000;

export const VERIF_OTRO_SYSTEM_PROMPT =
  'Decide si el cliente pide o pregunta por un vehículo DISTINTO al mostrado.\n' +
  'Si habla del mostrado (precio, km, ficha, fotos, crédito, visita, dudas, ok), responde null.\n' +
  'Si el vehículo mencionado es el suyo, para vender o dar en parte de pago, responde null.\n' +
  'Copia el vehículo LITERAL del mensaje del cliente. Responde solo JSON: {"otro": string | null}';

type PatioFamily = { family: string; glued: string };

let patioFamilyCache: { families: PatioFamily[]; at: number } | null = null;

export function resetPatioFamiliesCache(): void {
  patioFamilyCache = null;
}

export function patioFamiliesCacheFresh(now = Date.now()): boolean {
  return Boolean(
    patioFamilyCache && now - patioFamilyCache.at <= PATIO_FAMILIES_TTL_MS,
  );
}

function familiesFromPatio(patio: StockCar[]): PatioFamily[] {
  const seen = new Set<string>();
  const out: PatioFamily[] = [];
  for (const row of patio) {
    const family = normalizeModelText(modelFamily(row.model));
    if (family.length < 3 || seen.has(family)) {
      continue;
    }
    seen.add(family);
    const glued = family.replace(/[^a-z0-9]/g, '');
    const parts = normalizeModelText(row.model)
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const idx = parts.indexOf(family);
    const next = idx >= 0 ? parts[idx + 1] : undefined;
    if (next && next.length <= 3 && next.length >= 2) {
      const pair = `${family}${next}`;
      if (pair.length >= 5) {
        out.push({ family, glued: pair });
        continue;
      }
    }
    out.push({ family, glued: glued.length >= 3 ? glued : family });
  }
  return out;
}

export function rememberPatioFamilies(
  patio: StockCar[],
  now = Date.now(),
): PatioFamily[] {
  if (patio.length === 0) {
    return patioFamilyCache?.families ?? [];
  }
  patioFamilyCache = { families: familiesFromPatio(patio), at: now };
  return patioFamilyCache.families;
}

function familiesForSospecha(patio: StockCar[], now = Date.now()): PatioFamily[] {
  if (patio.length > 0) {
    return rememberPatioFamilies(patio, now);
  }
  if (patioFamiliesCacheFresh(now) && patioFamilyCache) {
    return patioFamilyCache.families;
  }
  return [];
}

function shownCarTokens(car: { brand: string; model: string }): Set<string> {
  const family = normalizeModelText(modelFamily(car.model));
  return new Set(
    [
      ...tokensDe(car.brand),
      ...tokensDe(car.model),
      normalizeModelText(car.brand),
      family,
      family.replace(/[^a-z0-9]/g, ''),
    ].filter((token) => token.length >= 2),
  );
}

function hasWholeToken(text: string, token: string): boolean {
  if (token.length < 3) {
    return false;
  }
  const n = normalizeModelText(text);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(n);
}

/**
 * Detector barato. Nunca decide solo: solo marca un fragmento sospechoso.
 * Marcas: detectBrand (léxico del patio). Modelos: familias de inventoryoracle.
 */
export function sospechaOtroVehiculo(
  customerText: string,
  car: { brand: string; model: string; year?: number | null },
  patio: StockCar[],
  lexicon: VehicleLexicon,
  pedido?: string | null,
): string | null {
  const shown = shownCarTokens(car);
  const askedBrand = detectBrand(customerText, lexicon);
  if (askedBrand) {
    const brandNorm = normalizeModelText(askedBrand);
    const carBrand = normalizeModelText(car.brand);
    if (brandNorm && brandNorm !== carBrand && !shown.has(brandNorm)) {
      return askedBrand;
    }
  }
  const shownFamily = normalizeModelText(modelFamily(car.model));
  for (const row of familiesForSospecha(patio)) {
    if (row.family === shownFamily || shown.has(row.family) || shown.has(row.glued)) {
      continue;
    }
    if (hasWholeToken(customerText, row.family)) {
      return row.family;
    }
    if (row.glued !== row.family && hasWholeToken(customerText, row.glued)) {
      return row.glued;
    }
  }
  if (
    pedido &&
    !mismaUnidadPorFila(pedido, car) &&
    evidenciaReal(pedido, customerText, '')
  ) {
    return pedido;
  }
  return null;
}

export function buildVerifOtroUser(input: {
  car: { brand: string; model: string; year?: number | null; color?: string | null };
  lastAssistantText: string;
  customerText: string;
}): string {
  const shown = [
    input.car.brand,
    input.car.model,
    input.car.year != null ? String(input.car.year) : '',
    input.car.color ?? '',
  ]
    .filter((part) => part.trim().length > 0)
    .join(' ');
  return [
    `Vehículo mostrado: ${shown}`,
    `Último mensaje del bot: ${input.lastAssistantText || '(ninguno)'}`,
    `Mensaje del cliente: ${input.customerText}`,
  ].join('\n');
}

export function parseVerifOtroJson(
  raw: string | null,
): { ok: true; otro: string | null } | { ok: false } {
  if (raw == null || !raw.trim()) {
    return { ok: false };
  }
  try {
    const parsed = JSON.parse(raw) as { otro?: unknown };
    if (parsed.otro == null || parsed.otro === '') {
      return { ok: true, otro: null };
    }
    if (typeof parsed.otro === 'string' && parsed.otro.trim()) {
      return { ok: true, otro: parsed.otro.trim() };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function debeConsultarRpcOtro(
  interested: InterestedCarSnapshot | null,
  otro: string | null,
  evidencia: boolean,
  mismaPorFila: boolean,
): boolean {
  return Boolean(interested) && Boolean(otro) && evidencia && !mismaPorFila;
}

export function normalizar(texto: string): string {
  return foldAccents(texto).toLowerCase();
}

export function tokensDe(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function evidenciaTokens(valor: string): string[] {
  return tokensDe(valor).filter((token) => token.length >= 2 || /^\d+$/.test(token));
}

function cubreTokens(valToks: string[], fuente: string): boolean {
  if (valToks.length === 0) {
    return false;
  }
  const srcToks = tokensDe(fuente);
  const srcSet = new Set(srcToks);
  if (valToks.every((token) => srcSet.has(token))) {
    return true;
  }
  const valGlued = valToks.join('');
  const srcGlued = srcToks.join('');
  if (valGlued.length >= 2 && srcGlued.includes(valGlued)) {
    return true;
  }
  if (srcGlued.length >= 2 && valGlued.includes(srcGlued)) {
    return true;
  }
  return valToks.every((token) => srcGlued.includes(token));
}

function esVersionPegada(token: string, parts: string[]): boolean {
  if (token.length < 3) {
    return false;
  }
  let acc = '';
  for (const part of parts) {
    acc += part;
    if (acc === token) {
      return true;
    }
  }
  return false;
}

/** Marca, familia, tokens largos del modelo, versión pegada y año de la fila. */
function tokenEsDelMostrado(
  token: string,
  car: { brand: string; model: string; year?: number | null },
): boolean {
  const brandToks = tokensDe(car.brand);
  const modelToks = tokensDe(car.model);
  const family = normalizeModelText(modelFamily(car.model));
  const gluedFamily = family.replace(/[^a-z0-9]/g, '');
  if (car.year != null && token === String(car.year)) {
    return true;
  }
  const owned = new Set(
    [...brandToks, ...modelToks.filter((part) => part.length >= 3), family, gluedFamily].filter(
      (part) => part.length >= 2,
    ),
  );
  if (owned.has(token)) {
    return true;
  }
  return (
    esVersionPegada(token, modelToks) ||
    esVersionPegada(token, brandToks) ||
    esVersionPegada(token, [...brandToks, ...modelToks])
  );
}

function textosBot(fuente: TextosBot): string[] {
  const lista = Array.isArray(fuente) ? [...fuente] : [fuente];
  return lista.slice(-3);
}

export function evidenciaReal(
  valor: string,
  customerText: string,
  lastAssistantText: TextosBot,
  car?: { brand: string; model: string; year?: number | null } | null,
): boolean {
  let valToks = evidenciaTokens(valor);
  if (car) {
    valToks = valToks.filter((token) => !tokenEsDelMostrado(token, car));
    if (valToks.length === 0) {
      return false;
    }
  }
  if (cubreTokens(valToks, customerText)) {
    return true;
  }
  return textosBot(lastAssistantText).some((texto) =>
    cubreTokens(valToks, texto),
  );
}

/** 10 min: si el flush no lee, no se queda en el Map. */
export const STAY_DECISION_TTL_MS = 10 * 60 * 1000;

export class StayDecisionStore {
  private readonly byContact = new Map<
    string,
    { decision: StayFila1Decision; at: number }
  >();

  save(contactId: string, decision: StayFila1Decision, now = Date.now()): void {
    this.prune(now);
    this.byContact.set(contactId, { decision, at: now });
  }

  /** get + delete. Null si no hay o ya expiró. */
  take(contactId: string, now = Date.now()): StayFila1Decision | null {
    this.prune(now);
    const entry = this.byContact.get(contactId);
    this.byContact.delete(contactId);
    if (!entry) {
      return null;
    }
    if (now - entry.at > STAY_DECISION_TTL_MS) {
      return null;
    }
    return entry.decision;
  }

  /** Siguiente turno del mismo contacto: no arrastra una decisión no leída. */
  discard(contactId: string): void {
    this.byContact.delete(contactId);
  }

  private prune(now: number): void {
    for (const [id, entry] of this.byContact) {
      if (now - entry.at > STAY_DECISION_TTL_MS) {
        this.byContact.delete(id);
      }
    }
  }
}

export function mismaUnidadPorFila(
  valor: string,
  car: { brand: string; model: string; year?: number | null },
): boolean {
  const filaTexto = `${car.brand} ${car.model}`;
  const filaToks = tokensDe(filaTexto);
  const filaPegada = filaToks.join('');
  const brandToks = new Set(tokensDe(car.brand));
  const yearToken = car.year != null ? String(car.year) : null;
  const restantes = tokensDe(valor).filter(
    (token) => token !== yearToken && !brandToks.has(token),
  );
  if (restantes.length === 0) {
    return true;
  }
  if (restantes.every((token) => token.length <= 2)) {
    return false;
  }
  const valorPegada = restantes.join('');
  if (valorPegada.length >= 3 && filaPegada.includes(valorPegada)) {
    return true;
  }
  const filaSet = new Set(filaToks);
  return restantes.every((token) => {
    if (token.length <= 2) {
      return filaSet.has(token);
    }
    if (filaSet.has(token)) {
      return true;
    }
    if (filaPegada.length > 0 && filaPegada.includes(token)) {
      return true;
    }
    if (token.length >= 3 && /\d/.test(token)) {
      return filaToks.some(
        (fila) =>
          fila.length >= 3 &&
          /\d/.test(fila) &&
          (fila.startsWith(token) || token.startsWith(fila)),
      );
    }
    return false;
  });
}

export function fila1Nueva(input: Fila1NuevaInput): {
  suelta: boolean;
  motivo: string;
} {
  const otro = input.otroOverride ?? resumenOtroVehiculo(input.resumen);
  if (!otro) {
    return { suelta: false, motivo: 'sin_otro' };
  }
  if (
    !evidenciaReal(
      otro,
      input.customerText,
      input.lastAssistantText,
      input.car,
    )
  ) {
    if (mismaUnidadPorFila(otro, input.car)) {
      return { suelta: false, motivo: 'misma_por_fila' };
    }
    return { suelta: false, motivo: 'sin_evidencia' };
  }
  if (askedOtherUnitFacts(otro, input.car)) {
    return { suelta: true, motivo: 'otro_anio_version_color' };
  }
  if (mismaUnidadPorFila(otro, input.car)) {
    return { suelta: false, motivo: 'misma_por_fila' };
  }
  if (input.otroEsLaMostrada === true) {
    return { suelta: false, motivo: 'misma_por_rpc' };
  }
  return { suelta: true, motivo: 'otro_vehiculo' };
}

function lastAssistantFrom(input: DecideStayNuevoInput): TextosBot {
  if (input.lastAssistantText != null) {
    return input.lastAssistantText;
  }
  return (input.history ?? [])
    .filter((item) => item.role === 'assistant')
    .map((item) => item.content)
    .slice(-3);
}

export function decideStayOnShown(
  input: DecideStayNuevoInput,
): { stay: boolean; motivo: string } {
  const car = input.car;
  if (!car) {
    return { stay: false, motivo: 'sin_unidad' };
  }
  if (shownLeavesByColor(input)) {
    return { stay: false, motivo: 'otro_color' };
  }
  if (shownLeavesByOtras(input)) {
    return { stay: false, motivo: 'pide_otras' };
  }
  if (shownLeavesByTope(input)) {
    return { stay: false, motivo: 'tope' };
  }
  const fila1 = fila1Nueva({
    resumen: input.resumen ?? '',
    customerText: input.text,
    lastAssistantText: lastAssistantFrom(input),
    car,
    otroEsLaMostrada: input.otroEsLaMostrada ?? null,
    otroOverride: input.otroOverride,
  });
  if (fila1.suelta) {
    return { stay: false, motivo: fila1.motivo };
  }
  if (shownLeavesByCaja(input)) {
    return { stay: false, motivo: 'caja' };
  }
  if (shownLeavesByTipo(input)) {
    return { stay: false, motivo: 'tipo' };
  }
  if (shownLeavesByCabina(input)) {
    return { stay: false, motivo: 'cabina' };
  }
  if (shownLeavesByTraccion(input)) {
    return { stay: false, motivo: 'traccion' };
  }
  if (shownLeavesByAsientos(input)) {
    return { stay: false, motivo: 'asientos' };
  }
  if (input.lastListed) {
    const stay = listedPickStaysCore(input, fila1.suelta);
    return { stay, motivo: stay ? 'listed_stay' : 'listed_otra' };
  }
  return { stay: true, motivo: fila1.motivo === 'sin_otro' ? 'sigue' : fila1.motivo };
}

export function leerFilasRpc(raw: unknown): Array<{
  id: string;
  similarity: number;
}> {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }
      const rec = row as Record<string, unknown>;
      const id = rec.id ?? rec.inventory_id;
      const similarity = rec.similarity;
      if (id == null || typeof similarity !== 'number') {
        return null;
      }
      return { id: String(id), similarity };
    })
    .filter((row): row is { id: string; similarity: number } => row != null);
}

export function interpretarOtroRpc(
  rows: Array<{ id: string; similarity: number }>,
  inventoryId: string,
  margen = MARGEN_RPC,
): RpcOtroResult {
  const rank1 = rows[0];
  if (!rank1) {
    return { otroEsLaMostrada: null, rank1Id: null, sim1: null, sim2: null };
  }
  const rank2 = rows[1];
  const misma =
    rank1.id === inventoryId &&
    (rows.length === 1 || rank1.similarity - (rank2?.similarity ?? 0) >= margen);
  return {
    otroEsLaMostrada: misma,
    rank1Id: rank1.id,
    sim1: rank1.similarity,
    sim2: rank2?.similarity ?? null,
  };
}

export async function consultarOtroEsLaMostrada(input: {
  otro: string;
  inventoryId: string;
  embed: (text: string) => Promise<number[] | null>;
  match: (embedding: number[], topK: number) => Promise<unknown>;
}): Promise<RpcOtroResult> {
  try {
    const emb = await input.embed(input.otro);
    if (!emb?.length) {
      return { otroEsLaMostrada: null, rank1Id: null, sim1: null, sim2: null };
    }
    const raw = await input.match(emb, 3);
    return interpretarOtroRpc(leerFilasRpc(raw), input.inventoryId);
  } catch {
    return { otroEsLaMostrada: null, rank1Id: null, sim1: null, sim2: null };
  }
}

export function formatStayLog(input: {
  contactId: string;
  inventory: string | null;
  stay: boolean;
  motivo: string;
  otro: string | null;
  evidencia: 'ok' | 'falla' | 'n/a';
  rpcRank1: string | null;
  rpcSim1: number | null;
  rpcSim2: number | null;
  sospecha?: string | null;
  verificado?: string | null;
}): string {
  const quoted = (value: string | null | undefined) =>
    value == null ? 'null' : `"${value.replace(/"/g, '\\"')}"`;
  const verificado =
    input.verificado == null
      ? 'null'
      : input.verificado === 'error' || input.verificado === 'timeout'
        ? input.verificado
        : quoted(input.verificado);
  const num = (value: number | null) => (value == null ? 'n/a' : String(value));
  return [
    `stay contactId=${input.contactId}`,
    `inventory=${input.inventory ?? 'n/a'}`,
    `stay=${input.stay}`,
    `motivo=${input.motivo}`,
    `otro=${quoted(input.otro)}`,
    `evidencia=${input.evidencia}`,
    `sospecha=${quoted(input.sospecha)}`,
    `verificado=${verificado}`,
    `rpcRank1=${input.rpcRank1 ?? 'n/a'}`,
    `rpcSim1=${num(input.rpcSim1)}`,
    `rpcSim2=${num(input.rpcSim2)}`,
  ].join(' ');
}
