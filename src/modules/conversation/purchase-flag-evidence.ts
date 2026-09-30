import type { VehicleKind } from './vehicle-kind';
import { COLORS } from './vehicle-brand';

/**
 * Categorías de formato de las banderas de compra (Tipo de patio, Caja,
 * Cabina, Tracción pedida, Color pedido). No son inventario ni un léxico
 * de modelos: solo las formas con las que el resumen nombra ese valor.
 */

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function has(corpus: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(corpus);
}

const TIPO_EVIDENCE: Record<VehicleKind, RegExp> = {
  camioneta:
    /\bcamionetas?\b|\bpick\s*ups?\b|\bcabinas?\b|\bdoble\s+cabina\b|\bcabina\s+simple\b/,
  suv: /\bsuvs?\b|\bjeeps?\b|\btodoterrenos?\b/,
  sedan: /\bsedans?\b/,
  hatchback: /\bhatchbacks?\b|\bhatch\b/,
};

const CAJA_EVIDENCE = {
  automatica: /\bautomatic|\bautomat|\bat\b/,
  manual: /\bmanual(?:es)?\b|\bmecanic|\bmt\b/,
};

const CABINA_EVIDENCE = {
  cd: /\bdoble\s+cabina\b|\bcabina\s+doble\b|\bcd\b/,
  cs: /\bcabina\s+simple\b|\bsimple\s+cabina\b|\bcs\b/,
};

const TRACCION_EVIDENCE = {
  '4x4': /\b4\s*x\s*4\b|\bdoble\s+traccion\b|\b4wd\b/,
  '4x2': /\b4\s*x\s*2\b|\bsencilla\b|\b2wd\b/,
};

/** Texto donde buscar evidencia: WhatsApp de este turno y/o último del bot. */
export function purchaseEvidenceCorpus(input: {
  customerText: string;
  lastBot?: string | null;
  solicitud?: string | null;
}): string {
  const sol = fold(input.solicitud ?? '').trim();
  const customer = input.customerText ?? '';
  const foldedCustomer = fold(customer).trim();
  const skipCustomer =
    Boolean(sol) &&
    sol.length >= 12 &&
    (foldedCustomer.includes(sol) || sol.includes(foldedCustomer));
  return fold([skipCustomer ? '' : customer, input.lastBot ?? ''].join('\n'));
}

export function textHasTipoEvidence(
  corpus: string,
  tipo: VehicleKind,
): boolean {
  return has(corpus, TIPO_EVIDENCE[tipo]);
}

/** Cualquier forma de camioneta / suv / sedán / hatchback. */
export function textHasTipoDimension(corpus: string): boolean {
  return (Object.keys(TIPO_EVIDENCE) as VehicleKind[]).some((tipo) =>
    textHasTipoEvidence(corpus, tipo),
  );
}

export function textHasCajaEvidence(
  corpus: string,
  caja: 'automatica' | 'manual',
): boolean {
  return has(corpus, CAJA_EVIDENCE[caja]);
}

/** Cualquier forma de automática o manual. */
export function textHasCajaDimension(corpus: string): boolean {
  return (
    textHasCajaEvidence(corpus, 'automatica') ||
    textHasCajaEvidence(corpus, 'manual')
  );
}

export function textHasCabinaEvidence(
  corpus: string,
  cab: 'cs' | 'cd',
): boolean {
  return has(corpus, CABINA_EVIDENCE[cab]);
}

/** Cualquier forma de cabina doble o simple (cabina, cd, cs). */
export function textHasCabinaDimension(corpus: string): boolean {
  return textHasCabinaEvidence(corpus, 'cd') || textHasCabinaEvidence(corpus, 'cs');
}

export function textHasTraccionEvidence(
  corpus: string,
  drive: '4x2' | '4x4',
): boolean {
  return has(corpus, TRACCION_EVIDENCE[drive]);
}

/** Cualquier forma de 4x4 o 4x2. */
export function textHasTraccionDimension(corpus: string): boolean {
  return (
    textHasTraccionEvidence(corpus, '4x4') ||
    textHasTraccionEvidence(corpus, '4x2')
  );
}

export function textHasColorPedidoEvidence(
  corpus: string,
  asked: string,
): boolean {
  const name = fold(asked).trim();
  if (!name) {
    return false;
  }
  const row = COLORS.find((item) => item.name === name);
  if (row) {
    row.pattern.lastIndex = 0;
    return row.pattern.test(corpus);
  }
  return new RegExp(`\\b${escapeRegExp(name)}\\b`).test(corpus);
}

/** Cualquier color de COLORS. */
export function textHasColorDimension(corpus: string): boolean {
  return COLORS.some((row) => {
    row.pattern.lastIndex = 0;
    return row.pattern.test(corpus);
  });
}
