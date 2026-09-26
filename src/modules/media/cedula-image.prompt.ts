export const CEDULA_IMAGE_PROMPT = `Esta imagen es una cédula o documento de identidad. Transcribe solo lo que se lee. No inventes.

Responde SOLO JSON:
{
  "numero": "los 10 dígitos de la cédula, sin espacios, o null si no se leen",
  "nombre": "nombre completo tal como está impreso, o null",
  "origen": "ciudad, provincia o lugar de nacimiento si se lee, o null"
}`;
