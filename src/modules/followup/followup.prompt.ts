import type { RetomaNumero } from './followup.constants';

export type FollowupPromptInput = {
  retoma: RetomaNumero;
  resumen: string;
  vehiculos: string[];
  objecion: string | null;
  objecionTexto: string | null;
  objecionEvidencia: string | null;
  presupuesto: string | null;
};

export const FOLLOWUP_SYSTEM_PROMPT = `Escribes el recado que el cliente lee en WhatsApp (variable de una plantilla).
La plantilla ya pone el saludo y la despedida. Tú solo el medio.

Eres el asesor. Hablas de usted, en segunda persona: "qué le pareció", "le cuento", "sigue disponible".
Nunca redactes un informe. Nunca hables de "el cliente" en tercera persona.

1 o 2 frases. Sin emojis. Sin "buen día", "estimado" ni cierre.
Solo nombra un carro si viene en HECHOS.
Devuelves solo ese recado, sin JSON ni comillas.`;

function carLabel(vehiculos: string[]): string {
  const named = vehiculos.map((name) => name.trim()).filter(Boolean);
  return named.join(', ') || 'el vehículo que vimos';
}

function factsBlock(input: FollowupPromptInput): string {
  const lines = [`Carro(s): ${carLabel(input.vehiculos)}`];
  if (input.objecion) {
    const said =
      input.objecionEvidencia?.trim() ||
      input.objecionTexto?.trim() ||
      input.objecion;
    lines.push(`Lo que objetó (palabras suyas): ${said}`);
  } else {
    lines.push('No objetó ni puso pero.');
  }
  if (input.presupuesto?.trim()) {
    lines.push(`Presupuesto que dijo: ${input.presupuesto.trim()}`);
  }
  return lines.join('\n');
}

function taskFor(retoma: RetomaNumero): string {
  if (retoma === 1) {
    return 'Pregúntale qué le pareció ESE carro y si quiere que le cuentes más. Una pregunta al cliente, no un resumen.';
  }
  if (retoma === 2) {
    return `Sigue el hilo del carro:
- si objetó el modelo: ofrece otra de patio (sin inventar stock)
- si objetó el precio: valida el rango con lo que dijo
- si no objetó: dile que sigue disponible y pregunta si avanza`;
  }
  return 'Recuérdale el valor de la casa (documentos en regla, placas al día, entrega inmediata, +35 años). PROHIBIDO garantía mecánica del carro. Cierra preguntando si le ayudamos con ESE carro.';
}

export function followupUserPrompt(input: FollowupPromptInput): string {
  return `TAREA
${taskFor(input.retoma)}

HECHOS (para saber de qué hablar; no los copies ni los narres)
${factsBlock(input)}

Así se ve bien: ¿Qué le pareció el Sportage? Si desea, le cuento más detalles.
Así se ve mal (informe, no lo hagas): El cliente mostró interés en el Sportage. No expresó objeciones ni mencionó presupuesto.

Escribe ahora el recado de ESTE caso.`;
}
