import { replyAsksIfApplies } from './financing-data';
import { hasDealershipAddress, MAP_URL } from './location-without-entrada';
import { mentionsAmount } from './strip-unsolicited-price';

type HiloMessage = { role: string; content: string };

/**
 * Qué piezas ya entregó el bot en el hilo. Se lee SOLO de lo que escribió el
 * bot (texto nuestro), nunca del texto del cliente. Si el cliente la vuelve a
 * pedir, eso lo decide el resumen por sentido; este registro solo da el hecho.
 */
export type EntregadoEnHilo = {
  direccion: boolean;
  precio: number | null;
  horario: boolean;
  preguntaAplica: boolean;
};

function botMessages(history: HiloMessage[] | undefined): string[] {
  return (history ?? [])
    .filter(
      (item) =>
        item.role === 'assistant' &&
        item.content &&
        !item.content.startsWith('CONTEXTO ASESOR'),
    )
    .map((item) => item.content);
}

function saysAddress(text: string): boolean {
  return hasDealershipAddress(text) || text.includes(MAP_URL);
}

function saysSchedule(text: string): boolean {
  return /\b0?8[:h]30\b/.test(text) && /\b18[:h]00\b/.test(text);
}

/**
 * `unitPrice` es el contado de la unidad de la que se habla; sin él no se puede
 * saber si el precio ya se dijo, y queda en null.
 */
export function entregadoEnHilo(
  history: HiloMessage[] | undefined,
  options?: { unitPrice?: number | null },
): EntregadoEnHilo {
  const bot = botMessages(history);
  const unitPrice = options?.unitPrice ?? null;
  return {
    direccion: bot.some(saysAddress),
    precio:
      unitPrice != null &&
      unitPrice > 0 &&
      bot.some((text) => mentionsAmount(text, unitPrice))
        ? unitPrice
        : null,
    horario: bot.some(saysSchedule),
    preguntaAplica: bot.some(replyAsksIfApplies),
  };
}

export function formatEntregadoForResumen(
  entregado: EntregadoEnHilo,
): string | null {
  const lines: string[] = [];
  if (entregado.direccion) {
    lines.push('- La dirección de la casa (con mapa)');
  }
  if (entregado.precio != null) {
    lines.push(`- El precio de contado de la unidad: $${entregado.precio}`);
  }
  if (entregado.horario) {
    lines.push('- El horario de atención');
  }
  if (entregado.preguntaAplica) {
    lines.push('- La pregunta de si ayudamos a ver si aplica al crédito');
  }
  return lines.length ? lines.join('\n') : null;
}

/** La misma lista, para el agente de ventas: no repetir salvo que el resumen lo pida. */
export function formatEntregadoForPedido(
  entregado: EntregadoEnHilo,
): string | null {
  const lista = formatEntregadoForResumen(entregado);
  if (!lista) {
    return null;
  }
  return `YA ENTREGADO EN EL HILO (no lo repitas, salvo que el resumen lo pida otra vez):\n${lista}`;
}