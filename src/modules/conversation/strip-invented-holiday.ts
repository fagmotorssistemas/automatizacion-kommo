const HOLIDAY_CLAIM = /feriad|asueto|festiv|\bpuentes?\b|no\s+laborable/i;

/** Sigue el cierre inventado aunque ya no diga la palabra feriado. */
const EXTENDED_CLOSE =
  /desde el (?:miercoles|jueves)|(?:lunes|martes|miercoles|jueves|viernes)\s+(?:y\s+\w+\s+)?(?:no\s+atend|esta(?:n|mos)?\s+cerrad|cerrad)/i;

/** Horario real del patio. No nombra feriados. */
export const HORARIO_REAL =
  'Atendemos de lunes a viernes de 08:30 a 18:00 y el sábado de 09:30 a 13:30. El domingo no atendemos.';

function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** El modelo inventó un cierre: feriado, puente, asueto o día festivo. */
export function replyInventsHoliday(text: string): boolean {
  return HOLIDAY_CLAIM.test(fold(text));
}

/**
 * Quita las frases que inventan un feriado.
 * Si no queda nada útil, deja el horario real. Si queda la dirección u otro dato, lo conserva.
 */
export function stripInventedHoliday(text: string): string {
  if (!replyInventsHoliday(text)) {
    return text;
  }
  const kept = text
    .split(/(?<=[.!;?])\s*/)
    .map((part) => part.trim())
    .filter((part) => {
      const plain = fold(part);
      return part && !HOLIDAY_CLAIM.test(plain) && !EXTENDED_CLOSE.test(plain);
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!kept) {
    return HORARIO_REAL;
  }
  const body = kept.charAt(0).toUpperCase() + kept.slice(1);
  return `${HORARIO_REAL} ${body}`;
}
