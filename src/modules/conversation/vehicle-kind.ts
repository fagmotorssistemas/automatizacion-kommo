export const VEHICLE_KINDS = ['camioneta', 'suv', 'sedan', 'hatchback'] as const;

export type VehicleKind = (typeof VEHICLE_KINDS)[number];

const DETECTORS: { kind: VehicleKind; pattern: RegExp }[] = [
  {
    kind: 'camioneta',
    pattern:
      /\b(?:camionet\w*|pick[\s-]?ups?|pikups?|picups?|doble cabina|cabina doble|cabina simple)\b/gi,
  },
  {
    kind: 'suv',
    pattern: /\b(?:suvs?|jeeps?|camperos?)\b/gi,
  },
  {
    kind: 'sedan',
    pattern: /\b(?:sed[aá]n(?:es)?|sedanes)\b/gi,
  },
  {
    kind: 'hatchback',
    pattern: /\b(?:hatchbacks?|hatckbacks?)\b/gi,
  },
];

const LABELS: Record<VehicleKind, string> = {
  camioneta: 'camioneta (pickup)',
  suv: 'SUV',
  sedan: 'sedán',
  hatchback: 'hatchback',
};

const BODY: Record<VehicleKind, string[]> = {
  camioneta: ['doble cabina', 'cabina doble', 'cabina simple'],
  suv: ['jeep', 'suv'],
  sedan: ['sedan'],
  hatchback: ['hatchback', 'hatckback'],
};

/** El type_body del inventario, sin una lista fija de modelos. */
export function kindFromTypeBody(
  typeBody: string | null | undefined,
): VehicleKind | null {
  const body = (typeBody ?? '').trim().toLowerCase();
  if (!body) {
    return null;
  }
  for (const kind of VEHICLE_KINDS) {
    if (BODY[kind].includes(body)) {
      return kind;
    }
  }
  return null;
}

/** Misma regla que el filtro SQL de inventario. */
export function matchesVehicleKind(
  typeBody: string | null | undefined,
  kind: VehicleKind,
): boolean {
  const body = (typeBody ?? '').trim().toLowerCase();
  return BODY[kind].includes(body);
}

export function parseVehicleKind(value: unknown): VehicleKind | null {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  return VEHICLE_KINDS.includes(text as VehicleKind) ? (text as VehicleKind) : null;
}

function foldWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

/**
 * Camioneta, camionetita y la misma palabra mal escrita.
 * Las consonantes tienen que seguir c/k + m + n + t, como en cmioneta o camioenta.
 */
export function looksLikeCamioneta(word: string): boolean {
  const token = foldWord(word);
  if (token.length < 6 || token.length > 16) {
    return false;
  }
  const bones = token.replace(/[aeiou]/g, '');
  return /^[ck]m+n+t+/.test(bones);
}

/** Última mención explícita de tipo dentro de un mensaje. */
export function detectVehicleKind(text: string): VehicleKind | null {
  let winner: { kind: VehicleKind; index: number } | null = null;

  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = detector.pattern.exec(text)) !== null) {
      if (!winner || match.index >= winner.index) {
        winner = { kind: detector.kind, index: match.index };
      }
    }
  }

  const words = /\b[a-záéíóúüñ]+\b/gi;
  let word: RegExpExecArray | null;
  while ((word = words.exec(text)) !== null) {
    if (!looksLikeCamioneta(word[0])) {
      continue;
    }
    if (!winner || word.index >= winner.index) {
      winner = { kind: 'camioneta', index: word.index };
    }
  }

  return winner?.kind ?? null;
}

/**
 * El tipo del carro en interested_cars manda.
 * Si en este mensaje dice camioneta, SUV, sedán o hatchback, ese dicho actualiza.
 * `remembered` cubre lo que ya se salió de la ventana del resumen.
 */
export function resolveVehicleKind(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: VehicleKind | null;
  /** type_body del último carro que pidió, ya traducido a camioneta/suv/sedán. */
  interestedKind?: VehicleKind | null;
}): VehicleKind | null {
  const saidNow = detectVehicleKind(input.customerText);
  if (saidNow) {
    return saidNow;
  }
  if (input.interestedKind) {
    return input.interestedKind;
  }

  let kind = input.remembered;
  for (const text of input.history) {
    if (text.role !== 'user') {
      continue;
    }
    const found = detectVehicleKind(text.content);
    if (found) {
      kind = found;
    }
  }

  return kind;
}

/** Bloque que se manda en cada turno para que el modelo no suelte el tipo. */
export function formatPedidoVigente(kind: VehicleKind | null): string {
  if (!kind) {
    return '';
  }

  return `PEDIDO VIGENTE DEL CLIENTE
Tipo: ${kind}
El cliente pidió ${LABELS[kind]}. Sigue vigente aunque pasen varios mensajes y no lo repita.
Solo ofrece vehículos de este tipo, SALVO que nombre un modelo de otro tipo (Hilux, Ranger = camioneta aunque antes haya pedido SUV).
Doble cabina, cabina doble y cabina simple son camioneta. PROHIBIDO un SUV o jeep si pidió camioneta o doble cabina.
4x2 y 4x4 son tracción, no cambian el tipo.
"Parecida" u "otra" es otro vehículo del mismo tipo.
En buscarvehiuclo pasa siempre tipo="${kind}".`;
}
