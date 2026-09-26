import { looksLikeCamioneta } from './vehicle-kind';

const FEATURE =
  /\b(?:pasajeros?|personas?|puestos|asientos|filas?|furgonet\w*|furg[oó]n(?:es)?|minivans?|minib[uú]s(?:es)?|microb[uú]s(?:es)?|techo|panor[aá]mic[oa]|autom[aá]tic[oa]s?|mec[aá]nic[oa]s?|manual(?:es)?|di[eé]sel|gasolina|el[eé]ctric[oa]s?|h[ií]brid[oa]s?|4\s*x\s*4|4\s*x\s*2|tracci[oó]n|4wd|awd|cuero|c[aá]mara|pantalla|full|lujo|barat[oa]s?|econ[oó]mic[oa]s?|presupuesto|trabajo|familiar|turbo|doble\s+cabina|cabina\s+simple|camionet\w*|pick[\s-]?ups?|suvs?|sed[aá]n(?:es)?|hatchbacks?|blanco|negro|rojo|azul|plomo|gris|plateado|verde|beige|dorado)\b/i;

/** Un pedido concreto es un requisito del carro, no solo la marca ni un sí. */
export function isConcreteAsk(text: string): boolean {
  if (FEATURE.test(text)) {
    return true;
  }
  return text.split(/[^\p{L}]+/u).some((word) => looksLikeCamioneta(word));
}

/** Año desde X, no “solo el 2023”. Tolera “en edelante / adelnte”. */
export function asksYearOnward(text: string): boolean {
  return (
    /\ben\s+[ae]?d+[ea]?l[ae]?nte\b/i.test(text) ||
    /\b(?:en\s+)?adelante\b/i.test(text) ||
    /\bo\s+m[aá]s\b/i.test(text) ||
    /\bdesde\b/i.test(text) ||
    /\ba\s+partir\b/i.test(text)
  );
}

/** Pedido con ficha (4x2, gasolina, cabina, desde un año): embedding, no filtro exacto. */
export function asksClosestByFacts(text: string): boolean {
  return isConcreteAsk(text) || asksYearOnward(text);
}

/**
 * El último requisito sigue vigente si el mensaje nuevo solo repite la marca.
 * `remembered` cubre lo que ya salió de la ventana del chat.
 */
export function resolveConcreteAsk(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: string | null;
}): string | null {
  let ask = input.remembered;
  const texts = [
    ...input.history
      .filter((item) => item.role === 'user')
      .map((item) => item.content),
    input.customerText,
  ];

  for (const text of texts) {
    const clean = text.trim();
    if (clean && isConcreteAsk(clean)) {
      ask = clean;
    }
  }

  return ask;
}
