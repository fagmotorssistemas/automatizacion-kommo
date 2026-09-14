/** Prompt de n8n (nodo OpenAI analyze). No reescribir de momento. */
export function vehicleImagePrompt(mensaje: string): string {
  return `Analiza esta imagen de vehículo y el mensaje del cliente.

TAREAS:
1. Identifica la MARCA del vehículo observando el logo
2. Identifica el MODELO si es posible
3. Identifica el TIPO de vehículo (SUV, Sedán, Hatchback, Pickup, Camioneta, Coupé, etc.)
4. Identifica el Color
5. Identifica la Placa si tiene: ejemplo "PJT3423"
6. Determina la INTENCIÓN del cliente:
   - ¿Quiere COMPRAR este vehículo a la concesionaria?
   - ¿Quiere VENDER/INTERCAMBIAR su vehículo con la concesionaria?

MENSAJE DEL CLIENTE: ${mensaje}

Responde SOLO en formato JSON sin backticks ni bloques de código:
{
  "marca": "nombre de la marca",
  "modelo": "modelo estimado o 'no identificado'",
  "tipo": "SUV/Sedán/Hatchback/Pickup/Camioneta/Coupé/Otro",
  "color": "color del vehículo",
  "placa": "placa del vehículo o 'no visible'",
  "intencion": "VENDER o COMPRAR",
  "confianza_marca": "alta/media/baja",
  "razonamiento": "1 frase explicando la intención, indicando que ya se analizó la foto enviada por el cliente y no es necesario pedir más imágenes"
}`;
}
