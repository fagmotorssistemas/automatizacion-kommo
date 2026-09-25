import { GREET_AFTER_MS } from './conversation.constants';

export type DayGreeting = 'Buenos días' | 'Buenas tardes' | 'Buenas noches';

/** Hora de Cuenca: días 00:00–11:59, tardes 12:00–18:59, noches 19:00–23:59. */
export function greetingForHour(hour: number): DayGreeting {
  if (hour >= 12 && hour < 19) {
    return 'Buenas tardes';
  }
  if (hour >= 19) {
    return 'Buenas noches';
  }
  return 'Buenos días';
}

/**
 * Un saludo: primer mensaje de ese cliente, o volvió después de días.
 * Si hay hilo y no sabemos cuándo fue, no saludamos (evita saludar a mitad).
 */
export function shouldOfferGreeting(input: {
  lastSeenAt: number | null;
  hasHistory: boolean;
  now?: number;
  gapMs?: number;
}): boolean {
  const now = input.now ?? Date.now();
  const gap = input.gapMs ?? GREET_AFTER_MS;
  if (input.lastSeenAt != null) {
    return now - input.lastSeenAt >= gap;
  }
  return !input.hasHistory;
}

export function askWhichCarMessage(
  greet: boolean,
  hour: number,
): string {
  const ask = '¿Qué carro le interesa?';
  if (!greet) {
    return `Con gusto. ${ask}`;
  }
  return `${greetingForHour(hour)}, estimado. ${ask}`;
}

export function formatGreetingPedido(greet: boolean, hour: number): string {
  if (!greet) {
    return `SALUDO: no
Ya hay hilo de hoy. PROHIBIDO buenos días, buenas tardes o buenas noches. Sigue de frente, con usted.`;
  }
  const phrase = `${greetingForHour(hour)}, estimado`;
  return `SALUDO: ${phrase}
Es el primer mensaje o volvió después de días. Empieza con "${phrase}" UNA vez. Esa frase ya es la hora de Cuenca: no inventes otra. No vuelvas a saludar en el siguiente turno.`;
}
