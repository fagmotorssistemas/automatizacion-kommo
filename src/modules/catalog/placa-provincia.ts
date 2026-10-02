import { sanitizePlateShort } from './plate-short';

/** Tabla oficial ANT, conjunto cerrado; no crece con el inventario */
export const PROVINCIA_POR_LETRA: Record<string, string> = {
  A: 'Azuay',
  B: 'Bolívar',
  C: 'Carchi',
  E: 'Esmeraldas',
  G: 'Guayas',
  H: 'Chimborazo',
  I: 'Imbabura',
  J: 'Santo Domingo de los Tsáchilas',
  K: 'Sucumbíos',
  L: 'Loja',
  M: 'Manabí',
  N: 'Napo',
  O: 'El Oro',
  P: 'Pichincha',
  Q: 'Orellana',
  R: 'Los Ríos',
  S: 'Pastaza',
  T: 'Tungurahua',
  U: 'Cañar',
  V: 'Morona Santiago',
  W: 'Galápagos',
  X: 'Cotopaxi',
  Y: 'Santa Elena',
  Z: 'Zamora Chinchipe',
};

export const FRASE_PLACA_PENDIENTE =
  'La placa se la confirmo en un momento.';

const CAMPOS_INTERNOS =
  /\b(?:plate_short|inventory_id|img_prefix)(?:\s*=\s*\S*)?\.?|\bkm=\S*|\bcaja=\S*/gi;

export function fraseDePlaca(
  plateShort: string | null | undefined,
): string | null {
  const plate = sanitizePlateShort(plateShort);
  if (!plate) {
    return null;
  }
  const letra = plate[0];
  const ultimo = plate[plate.length - 1];
  const provincia = PROVINCIA_POR_LETRA[letra];
  if (!provincia) {
    return `La placa empieza con ${letra} y termina en ${ultimo}.`;
  }
  return `La placa empieza con ${letra} (matriculado por primera vez en ${provincia}) y termina en ${ultimo}.`;
}

/** Línea de ficha para el LLM: placeholder + provincia, nunca el nombre plate_short. */
export function etiquetaPlacaFicha(
  plateShort: string | null | undefined,
): string {
  const plate = sanitizePlateShort(plateShort);
  if (!plate) {
    return 'sin placa (PROHIBIDO inventar placa; el km NO es placa)';
  }
  const provincia = PROVINCIA_POR_LETRA[plate[0]];
  return provincia
    ? `placa={{placa}} (matrícula: ${provincia})`
    : 'placa={{placa}}';
}

export function preguntaProvinciaPlaca(texto: string): boolean {
  if (/\bmatr[ií]cul/i.test(texto)) {
    return true;
  }
  const hits = Object.values(PROVINCIA_POR_LETRA).filter((nombre) =>
    new RegExp(
      `\\b${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    ).test(texto),
  );
  return hits.length >= 2;
}

export function plateShortDeReferencia(opts: {
  inventoryId?: string | null;
  interested?: { inventoryId?: string; plateShort?: string | null } | null;
  listedUnits?: Array<{ id: string; plateShort?: string | null }>;
}): string | null {
  const listed = opts.listedUnits ?? [];
  const id = opts.inventoryId?.trim();
  if (id) {
    const hit = listed.find((unidad) => unidad.id === id);
    if (hit) {
      return sanitizePlateShort(hit.plateShort);
    }
    if (opts.interested?.inventoryId === id) {
      return sanitizePlateShort(opts.interested.plateShort);
    }
    return null;
  }
  if (listed.length === 1) {
    return sanitizePlateShort(listed[0].plateShort);
  }
  if (listed.length === 0 && opts.interested) {
    return sanitizePlateShort(opts.interested.plateShort);
  }
  return null;
}

export function lexicalizarPlaca(
  mensaje: string,
  plateShort: string | null | undefined,
): string {
  const frase = fraseDePlaca(plateShort) ?? FRASE_PLACA_PENDIENTE;
  return mensaje.replace(/\{\{\s*placa\s*\}\}/gi, frase);
}

export function filtrarCamposInternos(mensaje: string): {
  mensaje: string;
  campoFiltrado: boolean;
} {
  CAMPOS_INTERNOS.lastIndex = 0;
  const stripped = mensaje.replace(CAMPOS_INTERNOS, '');
  if (stripped === mensaje) {
    return { mensaje, campoFiltrado: false };
  }
  const limpio = stripped
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { mensaje: limpio, campoFiltrado: true };
}

function placaDicha(mensaje: string): string | null {
  const empieza = mensaje.match(/empieza con\s+([A-Za-z])/i);
  const termina = mensaje.match(/termina en\s+(\d)/i);
  if (empieza || termina) {
    const letra = (empieza?.[1] ?? '').toUpperCase();
    const digito = termina?.[1] ?? '';
    return `${letra}${digito}` || null;
  }
  const corta = mensaje.match(
    /\bplaca(?:\s+es)?\s*:?\s*([A-Za-z]{1,3}-?\d{1,3})\b/i,
  );
  if (corta) {
    return sanitizePlateShort(corta[1]);
  }
  return null;
}

function coincideConPlateShort(dijo: string, correcto: string): boolean {
  const d = dijo.toUpperCase();
  const c = correcto.toUpperCase();
  if (d === c) {
    return true;
  }
  const letra = d.match(/[A-Z]/)?.[0];
  const digito = d.match(/\d/)?.[0];
  if (letra && letra !== c[0]) {
    return false;
  }
  if (digito && digito !== c[c.length - 1]) {
    return false;
  }
  return Boolean(letra || digito);
}

export function medirPlacaNoCoincide(
  mensaje: string,
  plateShort: string | null | undefined,
): { dijo: string; correcto: string } | null {
  if (!/\bplaca\b|empieza con/i.test(mensaje)) {
    return null;
  }
  const correcto = sanitizePlateShort(plateShort);
  if (!correcto) {
    return null;
  }
  const dijo = placaDicha(mensaje);
  if (!dijo || coincideConPlateShort(dijo, correcto)) {
    return null;
  }
  return { dijo, correcto };
}
