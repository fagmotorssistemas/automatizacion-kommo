/** Parsea hora del cliente (1:00 pm → 13:00) y valida contra horarios de patio. */

export type ParsedClock = { hour: number; minute: number; label: string };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function hasPeriod(
  text: string,
  period: 'manana' | 'tarde' | 'noche',
): boolean {
  return new RegExp(`\\b(?:de|en|por)\\s+la\\s+${period}\\b`).test(text);
}

/** Solo frases que parecen proponer hora de visita (no "7 pasajeros" ni "2023"). */
export function looksLikeClock(text: string): boolean {
  const n = normalize(text);
  if (!n) {
    return false;
  }
  if (/\b\d{1,2}:\d{2}\b/.test(n)) {
    return true;
  }
  if (/\b\d{1,2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\b/i.test(n)) {
    return true;
  }
  if (hasPeriod(n, 'manana') || hasPeriod(n, 'tarde') || hasPeriod(n, 'noche')) {
    return true;
  }
  // "a la 1", "a las 10", "para las 3"
  if (/\b(?:a|para)\s+las?\s+\d{1,2}\b/.test(n)) {
    return true;
  }
  // Mensaje casi solo hora: "1", "13", "1.00"
  if (/^\d{1,2}([:.]?\d{2})?\s*(?:h|hs)?$/.test(n)) {
    return true;
  }
  return false;
}

/** "1:00 pm", "1 de la tarde", "8 de la noche", "6 de la mañana". */
export function parseCustomerClock(text: string): ParsedClock | null {
  if (!looksLikeClock(text)) {
    return null;
  }

  const normalized = normalize(text);
  const match = normalized.match(
    /(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?\b/i,
  );
  if (!match) {
    return null;
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return null;
  }

  const meridiem = (match[3] ?? '').replace(/\./g, '').replace(/\s/g, '');
  // "de la mañana" ≠ la palabra "mañana" (día). Igual tarde/noche.
  const isMorning = meridiem === 'am' || hasPeriod(normalized, 'manana');
  const isAfternoon = meridiem === 'pm' || hasPeriod(normalized, 'tarde');
  const isNight = hasPeriod(normalized, 'noche');

  if (hour >= 13 && hour <= 23) {
    // ya 24h
  } else if (isMorning) {
    if (hour === 12) {
      hour = 0;
    }
  } else if (isNight) {
    if (hour === 12) {
      hour = 0; // 12 de la noche
    } else if (hour < 12) {
      hour += 12; // 8–11 de la noche → 20–23
    }
  } else if (isAfternoon) {
    if (hour < 12) {
      hour += 12;
    }
  } else if (hour >= 1 && hour <= 6) {
    // "la 1" / "a las 6" sin am/pm ni periodo → visita de tarde, NO madrugada
    hour += 12;
  }

  const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { hour, minute, label };
}

function minutesOf(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function fitsWeekdayHours(hour: number, minute: number): boolean {
  const m = minutesOf(hour, minute);
  return m >= 8 * 60 + 30 && m <= 18 * 60;
}

export function fitsSaturdayHours(hour: number, minute: number): boolean {
  const m = minutesOf(hour, minute);
  return m >= 9 * 60 + 30 && m <= 13 * 60 + 30;
}

/** Hint duro para el agente cuando el cliente propone una hora. */
export function formatVisitHourHint(customerText: string): string {
  const clock = parseCustomerClock(customerText);
  if (!clock) {
    return '';
  }

  const lv = fitsWeekdayHours(clock.hour, clock.minute);
  const sab = fitsSaturdayHours(clock.hour, clock.minute);

  const parts = [
    `HORA QUE DIJO EL CLIENTE: "${customerText.trim()}" = ${clock.label} (24h).`,
    'Conversión: 1:00 pm / 1 de la tarde = 13:00. "a las 8/10/11" o "a las 13" SIN decir noche = horario DIURNO (08:00 / 10:00 / 11:00 / 13:00). NUNCA asumas que es de noche si el cliente no dijo "de la noche" ni "pm" nocturno.',
    'Solo si dice explícito "8/10/11 de la noche" → 20/22/23:00 (cerrado). "1/6 de la mañana" → madrugada (cerrado).',
    'IMPORTANTE: "mañana a las 10" = día siguiente a las 10:00 DE LA MAÑANA. La palabra "mañana" es el DÍA, no la noche.',
    'No confundas 1 pm con el cierre del sábado (13:30).',
    'L-V 08:30–18:00 | Sáb 09:30–13:30 | Dom cerrado.',
  ];

  if (lv && sab) {
    parts.push(
      `Esa hora SÍ cabe L-V y SÍ cabe el sábado (cierra 13:30). Confirma la cita. Prohibido decir que no es posible por horario.`,
    );
  } else if (lv && !sab) {
    parts.push(
      `Esa hora SÍ cabe L-V. El sábado NO (cierra 13:30). Si hablaban de sábado, ofrece otra hora ≤13:30; si era L-V, confirma.`,
    );
  } else if (!lv && sab) {
    parts.push(
      `Esa hora solo cabe el sábado. L-V no (abre 08:30 / cierra 18:00).`,
    );
  } else {
    parts.push(
      `Esa hora es FUERA DE ATENCIÓN (madrugada o noche). Prohibido confirmar, agendar o decir "le esperamos" a esa hora.`,
      `Dile que no atendemos a esa hora y ofrece otra dentro de L-V 08:30–18:00 o sáb 09:30–13:30. No inventes horarios.`,
    );
  }

  return parts.join('\n');
}
