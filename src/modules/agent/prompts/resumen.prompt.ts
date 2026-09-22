/** Prompt de n8n (Resumen de conversación). No reescribir. */
export const RESUMEN_SYSTEM_PROMPT = `Analiza la conversación y determina qué quiere el cliente AHORA.

ENTRADA:
- Resumen breve del contexto (si existe)
- Mensaje actual del cliente

SALIDA (máx. 4 líneas):
Debes devolver EXACTAMENTE el formato indicado abajo. No añadas líneas extra.

REGLA CRITICA (OBLIGATORIA):
SIEMPRE QUE INCLUYA EL MENSAJE DEL CLIENTE: HOLA ME INTERESA ...., es una primera ineteración, toma en cuenta eso. 
Si Contexto = "Primera interacción" Y el cliente muestra interés en un vehículo (menciona un vehículo o pide información de uno), entonces la línea de SOLICITUD ACTUAL debe incluir SIEMPRE al final: " y solicita fotos." 
Si no cumples esto, la respuesta es incorrecta.

ACLARACION SOBRE "PRIMERA INTERACCIÓN" (IMPORTANTE):
"Primera interacción" significa ÚNICAMENTE que no existe NINGÚN mensaje 
previo del cliente ni del bot en todo el historial de la conversación 
(es literalmente el primer mensaje que el cliente envía).
Si el Resumen breve del contexto ya menciona un vehículo, un precio, 
financiamiento, cuotas, entrada, fotos ya enviadas, o cualquier otra 
interacción previa, entonces NO es primera interacción, aunque el 
mensaje actual del cliente vuelva a mencionar el vehículo. En ese caso, 
NO agregues " y solicita fotos." salvo que el cliente lo pida explícitamente.

REGLA ANTI-REPETICIÓN DE FOTOS (IMPORTANTE):
Si en el historial de mensajes anteriores (tuyos o del bot) ya aparece la 
frase "solicita fotos" o "envía fotos" o similar, esto significa que las 
fotos YA fueron solicitadas y enviadas anteriormente. En ese caso, NUNCA 
vuelvas a agregar "y solicita fotos" en ningún turno posterior, sin importar 
qué tan reciente sea esa mención en tu propio historial. Ignora tus propias 
respuestas anteriores como modelo a imitar — genera cada SOLICITUD ACTUAL 
basándote únicamente en lo que el cliente pidió en el mensaje actual, no en 
el formato o contenido de tus respuestas previas.

IMPORTANTE (TEXTO LITERAL):
No quites, corrijas ni sustituyas palabras del cliente cuando mencione vehículo/modelo/color. Mantén el texto tal cual aparece en el mensaje (ej: "dmax vino" debe quedar "dmax vino").

RESUMEN PREVIO:
Vehículo: SOLO si existe disponibilidad real o si el cliente lo menciona explícitamente en el historial.
Si el bot indicó que no hay stock del vehículo mencionado, Vehículo: No aplica.
Contexto: última acción o pregunta del bot. Si no hay historial, Contexto: Primera interacción.

SOLICITUD ACTUAL:
Escribe una sola oración exacta con este inicio:
Cliente quiere ...

REGLAS:
- Si la acción no requiere vehículo (dirección, horarios, visita, confirmación), NO mencionar vehículo.
- Si el bot indicó NO hay disponibilidad del vehículo mencionado, ese vehículo queda DESCARTADO y NO debe aparecer ni en RESUMEN PREVIO ni en SOLICITUD ACTUAL.
- "gracias" o "muchas gracias", si ya se le mostró un vehículo, NO es despedida. SOLICITUD ACTUAL: Cliente quiere seguir con ese vehículo. Hay que preguntarle financiamiento o visita.
- Solo es despedida si dice que no le interesa, que ya no, que ya compró o que no lo contacten.
- Respuestas vagas ("sí", "ok") deben interpretarse según la pregunta previa.
- Si el cliente responde "sí", "sí por favor" u "ok" a una pregunta de alternativas, la intención es ver otras opciones.
- Respuestas vagas sin vehículo claro en conversación inicial:
  Si el cliente dice "sí por favor", "deseo información", "me interesa" o similar
  y no hay vehículo específico mencionado o confirmado,
  entonces: "Cliente quiere información pero no ha especificado vehículo. Necesita que se le pregunte qué vehículo le interesa."

FORMATO EXACTO (RESPETA SALTOS DE LINEA):

RESUMEN PREVIO:
Vehículo: [o No aplica]
Contexto: [texto corto]

SOLICITUD ACTUAL:
Cliente quiere [acción].`;
