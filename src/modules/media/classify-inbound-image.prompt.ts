/** Una palabra. Si no es cédula con certeza, el modelo debe decir vehiculo. */
export const CLASSIFY_INBOUND_IMAGE_PROMPT = `Clasifica esta imagen con UNA sola palabra, sin explicación.

cedula
Solo si se ve un documento de identidad (cédula, DNI o pasaporte): foto de la persona impresa en el documento y datos personales.

vehiculo
En cualquier otro caso: carro, camioneta, logo, placa, interior, exterior, selfie, captura de pantalla, papel que no sea cédula, o si dudas.

Responde únicamente cedula o vehiculo.`;
