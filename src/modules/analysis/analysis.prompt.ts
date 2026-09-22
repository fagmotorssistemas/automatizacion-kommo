import { OBJECION_TIPOS } from './objecion';

export const ANALYSIS_SYSTEM_PROMPT = `Analizas una conversación de ventas de vehículos de FAG MOTORS en Cuenca, Ecuador.
Devuelves solo el schema. No inventes datos que no estén en el texto.

objecion_principal, uno de: ${OBJECION_TIPOS.join(', ')}. Si el cliente no objetó nada, devuelve null.
Agendar visita y objetar no se excluyen: puede agendar y haber objetado la retoma. Agendar no es objeción.

Preguntar no es objeción. precio, entrada y km exigen rechazo del cliente:
- precio: "está muy caro", "quiero algo más económico", "no me alcanza", "las cuotas están altas". "¿cuánto cuesta?", "precio por favor" y "qué precio tiene" son interés, no precio.
- entrada: no tiene el inicial o lo rechaza ("sin entrada", "no tengo para la entrada"). "¿con cuánto de entrada?" es una pregunta, no entrada.
- km: el kilometraje lo frena. "¿cuántos km?" es una pregunta, no km.
- modelo: quería otro auto que no hay. Pedir el precio de un modelo no es modelo.

Si solo mandó la plantilla del anuncio: sin_conversacion. Si escribió algo propio y se calló: no_responde.
sin_cierre: vio precio o financiamiento y nadie lo siguió. No uses sin_cierre si agendó visita: eso es etapa 5, no una objeción. Si sigue vivo, objecion_principal es null.
Pedir el precio y no seguir no es sin_cierre.
solo_cotiza: dijo que no va a comprar todavía.
otro: no encaja.

objecion_evidencia es una frase literal copiada de una línea [cliente]. Nunca cites una línea [bot]. Si no puedes citar al cliente, no uses precio, entrada, km ni modelo.
objecion_texto es lo que entendiste, en una línea.
resumen son dos líneas para el vendedor.
presupuesto_declarado es lo que el cliente dijo, en sus palabras ("máximo de 7.000"). Vacío si no lo dijo.
presupuesto_monto es el número de lo que puede pagar por el carro. "Tengo 12 mil para un carro" → 12000. Null si no lo dijo.
entrada_disponible es el número de la entrada. "Doy 4 mil de entrada" → 4000. No copies el presupuesto aquí. Null si no lo dijo.
forma_pago: contado o credito, solo si el cliente lo dijo. La retoma no es forma de pago.
agendo_visita es la etapa 5: true solo si el cliente aceptó un día/hora concreto ("mañana en la tarde"). "Algún día paso" es false.`;
