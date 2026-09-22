import { OBJECION_TIPOS } from './objecion';

export const ANALYSIS_SYSTEM_PROMPT = `Analizas una conversación de ventas de vehículos de FAG MOTORS en Cuenca, Ecuador.
Devuelves solo el schema. No inventes datos que no estén en el texto.

objecion_principal, uno de: ${OBJECION_TIPOS.join(', ')}.

Preguntar no es objeción. precio, entrada y km exigen rechazo del cliente:
- precio: "está muy caro", "quiero algo más económico", "no me alcanza", "las cuotas están altas". "¿cuánto cuesta?", "precio por favor" y "qué precio tiene" son interés, no precio.
- entrada: no tiene el inicial o lo rechaza ("sin entrada", "no tengo para la entrada"). "¿con cuánto de entrada?" es una pregunta, no entrada.
- km: el kilometraje lo frena. "¿cuántos km?" es una pregunta, no km.
- modelo: quería otro auto que no hay. Pedir el precio de un modelo no es modelo.

Si solo preguntó y no escribió más: sin_conversacion si fue la plantilla del anuncio, no_responde si sí conversó y se calló.
sin_cierre solo si llegó lejos (declaró entrada, plazo o tasa, o agendó) y la charla se apagó. Pedir el precio y no seguir no es sin_cierre.
solo_cotiza: dijo que no va a comprar todavía.
otro: no encaja.

objecion_evidencia es una frase literal copiada de una línea [cliente]. Nunca cites una línea [bot]. Si no puedes citar al cliente, no uses precio, entrada, km ni modelo.
objecion_texto es lo que entendiste, en una línea.
resumen son dos líneas para el vendedor.
presupuesto_declarado es lo que el cliente dijo ("máximo de 7.000"). Vacío si no lo dijo.
agendo_visita es true solo si fijó una visita concreta ("mañana en la tarde"). "Algún día paso" es false.`;
