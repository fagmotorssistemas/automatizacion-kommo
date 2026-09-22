import type { RetomaNumero } from './followup.constants';

export const FOLLOWUP_SYSTEM_PROMPT = `Escribes SOLO el texto que va dentro de la variable de una plantilla WhatsApp (no el saludo ni el cierre: eso ya lo pone la plantilla).
FAG MOTORS / KsiNuevos, Cuenca. No relees el chat: solo el análisis.

Regla de largo: 1 o 2 frases cortas, pocas líneas. Completa la idea; no dejes la frase a medias.
Sin emojis. Sin "buen día" ni despedida.
No inventes precios ni modelos que no estén en el input.
Devuelves solo ese texto, sin JSON ni comillas.`;

export function followupUserPrompt(input: {
  retoma: RetomaNumero;
  resumen: string;
  vehiculos: string[];
  objecion: string | null;
  objecionTexto: string | null;
  objecionEvidencia: string | null;
  presupuesto: string | null;
}): string {
  const base = [
    `Retoma: ${input.retoma}`,
    `Resumen: ${input.resumen || '(sin resumen)'}`,
    `Vehículos consultados: ${input.vehiculos.join(', ') || '(ninguno)'}`,
    `Objeción: ${input.objecion ?? 'ninguna'}`,
    `Objeción (texto): ${input.objecionTexto ?? ''}`,
    `Evidencia: ${input.objecionEvidencia ?? ''}`,
    `Presupuesto: ${input.presupuesto ?? ''}`,
  ].join('\n');

  if (input.retoma === 1) {
    return `${base}\n\nSolo el punto 1: qué le pareció el vehículo (vehículos + resumen). 1-2 frases.`;
  }
  if (input.retoma === 2) {
    return `${base}\n\nSolo el punto 2: validar el vehículo según la objeción.
- modelo → alternativa del inventario (sin inventar stock)
- precio → valida el rango
- sin objeción → confirma disponibilidad
1-2 frases.`;
  }
  return `${base}\n\nSolo el punto 3: valor de KsiNuevos (documentos en regla, placas al día, entrega inmediata, +35 años). PROHIBIDO garantía del vehículo. 1-2 frases.`;
}
