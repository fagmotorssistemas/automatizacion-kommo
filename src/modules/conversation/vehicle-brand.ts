const BRANDS: { name: string; pattern: RegExp }[] = [
  { name: 'great wall', pattern: /\bgreat\s*wall\b|\bgwm\b/gi },
  { name: 'mercedes benz', pattern: /\bmercedez?(?:\s*benz)?\b/gi },
  { name: 'volkswagen', pattern: /\bvolkswagen\b|\bvw\b/gi },
  { name: 'zx auto', pattern: /\bzx(?:\s*auto)?\b/gi },
  { name: 'chevrolet', pattern: /\bchevrolet\b|\bchevy\b/gi },
  { name: 'citroen', pattern: /\bcitro[eë]n\b/gi },
  { name: 'mitsubishi', pattern: /\bmitsubishi\b/gi },
  { name: 'peugeot', pattern: /\bpeugeot\b/gi },
  { name: 'hyundai', pattern: /\bhyundai\b/gi },
  { name: 'toyota', pattern: /\btoyota\b/gi },
  { name: 'nissan', pattern: /\bnissans?\b/gi },
  { name: 'suzuki', pattern: /\bsuzuki\b/gi },
  { name: 'jetour', pattern: /\bjetour\b/gi },
  { name: 'changan', pattern: /\bchangan\b/gi },
  { name: 'chery', pattern: /\bchery\b/gi },
  { name: 'foton', pattern: /\bfot[oó]n\b/gi },
  { name: 'mazda', pattern: /\bmazda\b/gi },
  { name: 'ford', pattern: /\bford\b/gi },
  { name: 'kia', pattern: /\bkia\b/gi },
  { name: 'jac', pattern: /\bjac\b/gi },
  { name: 'fiat', pattern: /\bfiat\b/gi },
  { name: 'faw', pattern: /\bfaw\b/gi },
  { name: 'audi', pattern: /\baudi\b/gi },
  { name: 'ram', pattern: /\bram\b/gi },
  { name: 'mini', pattern: /\bmini\b/gi },
  { name: 'byd', pattern: /\bbyd\b/gi },
];

const TRES_FILAS =
  /\b(?:3|tres)\s+filas?\b|\b7\s*pasajeros?\b|\bsiete\s+pasajeros?\b/i;

export function detectBrand(text: string): string | null {
  let winner: { name: string; index: number } | null = null;

  for (const brand of BRANDS) {
    brand.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = brand.pattern.exec(text)) !== null) {
      if (!winner || match.index >= winner.index) {
        winner = { name: brand.name, index: match.index };
      }
    }
  }

  return winner?.name ?? null;
}

export function resolveBrand(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: string | null;
}): string | null {
  let brand = input.remembered;
  const texts = [
    ...input.history
      .filter((item) => item.role === 'user')
      .map((item) => item.content),
    input.customerText,
  ];

  for (const text of texts) {
    const found = detectBrand(text);
    if (found) {
      brand = found;
    }
  }

  return brand;
}

export function detectTresFilas(text: string): boolean {
  return TRES_FILAS.test(text);
}

export function resolveTresFilas(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: boolean;
}): boolean {
  if (input.remembered) {
    return true;
  }

  const texts = [
    ...input.history
      .filter((item) => item.role === 'user')
      .map((item) => item.content),
    input.customerText,
  ];
  return texts.some((text) => detectTresFilas(text));
}
