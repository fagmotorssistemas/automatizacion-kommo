const FEATURE =
  /\b(?:pasajeros?|puestos|asientos|filas?|techo|panor[aá]mic[oa]|autom[aá]tic[oa]s?|mec[aá]nic[oa]s?|di[eé]sel|gasolina|el[eé]ctric[oa]s?|h[ií]brid[oa]s?|4\s*x\s*4|4\s*x\s*2|tracci[oó]n|4wd|awd|cuero|c[aá]mara|pantalla|full|lujo|barat[oa]s?|econ[oó]mic[oa]s?|presupuesto|trabajo|familiar|turbo|doble\s+cabina|cabina\s+simple|camionetas?|pick[\s-]?ups?|suvs?|sed[aá]n(?:es)?|hatchbacks?|blanco|negro|rojo|azul|plomo|gris|plateado|verde|beige|dorado)\b/i;

/** Un pedido concreto es un requisito del carro, no solo la marca ni un sí. */
export function isConcreteAsk(text: string): boolean {
  return FEATURE.test(text);
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
