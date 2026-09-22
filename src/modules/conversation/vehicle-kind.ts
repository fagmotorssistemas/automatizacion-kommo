export const VEHICLE_KINDS = ['camioneta', 'suv', 'sedan', 'hatchback'] as const;

export type VehicleKind = (typeof VEHICLE_KINDS)[number];

const DETECTORS: { kind: VehicleKind; pattern: RegExp }[] = [
  {
    kind: 'camioneta',
    pattern: /\b(?:camionetas?|pick[\s-]?ups?|doble cabina|cabina doble|cabina simple)\b/gi,
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

export function parseVehicleKind(value: unknown): VehicleKind | null {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  return VEHICLE_KINDS.includes(text as VehicleKind) ? (text as VehicleKind) : null;
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

  return winner?.kind ?? null;
}

/**
 * El tipo dicho antes sigue vigente si el mensaje nuevo no lo cambia.
 * `remembered` cubre lo que ya se salió de la ventana del resumen.
 */
export function resolveVehicleKind(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: VehicleKind | null;
}): VehicleKind | null {
  let kind = input.remembered;
  const texts = [
    ...input.history
      .filter((item) => item.role === 'user')
      .map((item) => item.content),
    input.customerText,
  ];

  for (const text of texts) {
    const found = detectVehicleKind(text);
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

  const poer =
    kind === 'camioneta'
      ? '\nPoer es la Great Wall Poer y es camioneta. Si la nombra, busca "great wall poer".'
      : '';

  return `PEDIDO VIGENTE DEL CLIENTE
Tipo: ${kind}
El cliente pidió ${LABELS[kind]}. Sigue vigente aunque pasen varios mensajes y no lo repita.
Solo ofrece vehículos de este tipo. "Parecida" u "otra" es otro vehículo del mismo tipo, no un carro de otro tipo con nombre parecido.
En buscarvehiuclo pasa siempre tipo="${kind}".${poer}`;
}
