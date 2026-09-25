import { GREET_AFTER_MS } from './conversation.constants';

export type DayGreeting = 'Buenos días' | 'Buenas tardes' | 'Buenas noches';

const ASK_WHICH_CAR = [
  '¿Qué carro le interesa?',
  '¿Cuál vehículo tiene en mente?',
  'Dígame marca o modelo y le ayudo.',
] as const;

const ASK_WHICH_PRICE = [
  '¿De qué vehículo?',
  '¿De cuál carro le paso el precio?',
] as const;

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
 * Un saludo: primer mensaje, volvió después de días, o hay hilo sin sello
 * (lead viejo: el chat sigue en Redis y lastSeen nunca se guardó).
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
  return true;
}

export function looksLikeAskWhichCar(text: string): boolean {
  return (
    ASK_WHICH_CAR.some((line) => text.includes(line)) ||
    ASK_WHICH_PRICE.some((line) => text.includes(line))
  );
}

function pickAskLine(pool: readonly string[], lastAssistant: string): string {
  return pool.find((line) => !lastAssistant.includes(line)) ?? pool[0];
}

export function askWhichCarMessage(
  greet: boolean,
  hour: number,
  opts?: { lastAssistant?: string; wantsPrice?: boolean },
): string {
  const last = opts?.lastAssistant ?? '';
  const repeating = looksLikeAskWhichCar(last);
  const pool = opts?.wantsPrice ? ASK_WHICH_PRICE : ASK_WHICH_CAR;
  const ask = pickAskLine(pool, last);
  if (greet) {
    return `${greetingForHour(hour)}, estimado. ${ask}`;
  }
  if (opts?.wantsPrice) {
    return repeating ? `Claro. ${ask}` : `Con gusto le indico el valor. ${ask}`;
  }
  if (repeating) {
    return `Claro. ${ask}`;
  }
  return `Con gusto. ${ask}`;
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
