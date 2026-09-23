/** Fotos solo si el cliente las pide, o si es la primera vez que se presenta ESE carro. */
export function shouldSendVehiclePhotos(input: {
  inventoryId: string;
  alreadyShown: boolean;
  wantsPhotos: boolean;
  /** Precio/km de un carro que ya venían viendo: no reabrir el paquete de fotos. */
  skipFirstShot?: boolean;
}): boolean {
  if (!input.inventoryId.trim()) {
    return false;
  }
  if (input.wantsPhotos) {
    return true;
  }
  if (input.skipFirstShot) {
    return false;
  }
  return !input.alreadyShown;
}

export function asksForPhotos(text: string): boolean {
  return /\bfotos?\b/i.test(text);
}
