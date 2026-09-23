import { formatMileageForPrompt } from '../catalog/mileage';
import type { PostFotosPaso } from './post-fotos.constants';

export type PostFotosCarInput = {
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  fuelType: string | null;
  color: string | null;
};

const SHARED_RULES = `
REGLAS ESTRICTAS:
- Máximo 2 líneas
- Empieza con el nombre del cliente
- SIEMPRE trato de "usted". Prohibido tutear: te, tú, tu, tus, prefieres, quieres, tienes, puedes, dime.
- Correcto: "le envié", "le gustó", "prefiere que le busque otra opción"
- Incorrecto: "te envié", "te gustó", "prefieres que te busque"
- Tono WhatsApp Ecuador, natural, sin sonar a bot
- Sin "estimado", sin "carrito", sin emojis
- Sin saludos largos
- No inventes datos del vehículo: usa solo los del contexto
- No menciones kilometraje alto ni frases de justificación ("aunque", "a pesar de"). Si hablas del carro, di DIRECTO que está cuidado.
`.trim();

export function postFotosSystemPrompt(paso: PostFotosPaso): string {
  if (paso === 1) {
    return `Eres asesor de KSINUEVOS en Cuenca. Hace rato se enviaron fotos de un vehículo y el cliente no respondió.

TU TAREA: mensaje corto para VALIDAR el vehículo / saber qué le pasó.
Pregunta con naturalidad si le gustó, si le pareció, o qué le detiene (sin presión agresiva).
Invita a que le escriba si quiere otra opción o más detalle.
${SHARED_RULES}`;
  }

  if (paso === 2) {
    return `Eres asesor de KSINUEVOS en Cuenca. Ya preguntamos antes y el cliente sigue sin responder tras ver fotos.

TU TAREA: mensaje corto preguntando qué le PARECIÓ el vehículo.
Una pregunta clara y cálida. Ofrece aclarar dudas o verlo en patio.
${SHARED_RULES}`;
  }

  return `Eres asesor de KSINUEVOS en Cuenca. El cliente vio fotos y aún no responde (tercer contacto).

TU TAREA: mensaje corto con valor de la casa (NO garantía del carro):
- Documentos en regla, placas al día, entrega inmediata
- Más de 35 años en ventas / trayectoria de KSINUEVOS
Cierra invitando a escribir o pasar al patio.
PROHIBIDO: decir "garantía" del vehículo, garantía mecánica, o que el auto tiene garantía.
Si el tema fuera garantía del carro: se puede traer al mecánico; son seminuevos (no inventes cobertura del auto).
No suenes a spam ni listes un catálogo genérico.
${SHARED_RULES}`;
}

export function postFotosUserPrompt(car: PostFotosCarInput): string {
  return [
    `nombre: ${car.name}`,
    `marca: ${car.brand ?? ''}`,
    `modelo: ${car.model ?? ''}`,
    `año: ${car.year ?? ''}`,
    `precio: ${car.price ?? ''}`,
    `kilometraje: ${formatMileageForPrompt(car.mileage)}`,
    `fuel_type: ${car.fuelType ?? ''}`,
    `color: ${car.color ?? ''}`,
  ].join('\n');
}

const TUTEO_TO_USTED: [RegExp, string][] = [
  [/\bpara ti\b/gi, 'para usted'],
  [/\ba ti\b/gi, 'a usted'],
  [/\bcontigo\b/gi, 'con usted'],
  [/\bavísame\b/gi, 'avíseme'],
  [/\bescríbeme\b/gi, 'escríbame'],
  [/\bcuéntame\b/gi, 'cuénteme'],
  [/\bdime\b/gi, 'dígame'],
  [/\bprefieres\b/gi, 'prefiere'],
  [/\bquieres\b/gi, 'quiere'],
  [/\btienes\b/gi, 'tiene'],
  [/\bpuedes\b/gi, 'puede'],
  [/\bestás\b/gi, 'está'],
  [/\btus\b/gi, 'sus'],
  [/\btú\b/gi, 'usted'],
  [/\btu\b/gi, 'su'],
  [/\bte\b/gi, 'le'],
];

/** Pasa tuteo a usted. No toca palabras como "este" o "Tucson". */
export function rewritePostFotosUsted(text: string): string {
  return TUTEO_TO_USTED.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text,
  );
}

export function flattenPostFotosMessage(text: string): string {
  return rewritePostFotosUsted(text.replace(/[\n\r]+/g, ' ').trim());
}
