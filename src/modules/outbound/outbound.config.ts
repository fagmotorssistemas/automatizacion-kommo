export const OUTBOUND_CONFIG = 'OUTBOUND_CONFIG';

export type OutboundConfig = {
  /** Recibe y genera respuesta, pero no escribe en Kommo ni dispara salesbots. */
  shadowMode: boolean;
};

export function parseShadowMode(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}
