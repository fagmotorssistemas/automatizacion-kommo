/** Typos frecuentes del cliente → sentido real (no inventar modelos). */

const REWRITES: { pattern: RegExp; to: string }[] = [
  { pattern: /\bmanuelas?\b/gi, to: 'manual' },
  { pattern: /\bzusukis?\b/gi, to: 'suzuki' },
  { pattern: /\bfotones?\b/gi, to: 'foton' },
  { pattern: /\bhilu[sx]\b/gi, to: 'hilux' },
  { pattern: /\b4\s+runner\b/gi, to: '4runner' },
];

export function rewriteCustomerTypos(text: string): string {
  let out = text;
  for (const rule of REWRITES) {
    out = out.replace(rule.pattern, rule.to);
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/** Si dijo "Manuela", es caja manual: no buscar un carro con ese nombre. */
export function formatTransmissionTypoHint(customerText: string): string {
  if (!/\bmanuelas?\b/i.test(customerText)) {
    return '';
  }
  return [
    'CORRECCIÓN OBLIGATORIA: "Manuela" / "Manuelas" = transmisión MANUAL (mecánica). NO es un modelo ni una marca.',
    'Prohibido decir que no hay un vehículo llamado Manuela.',
    'Prohibido ofrecer Mercedes, Chery, Volkswagen u otras marcas al azar por ese error.',
    'Aplica el filtro MANUAL al vehículo/modelo que ya estaba hablando (ej. Picanto) y responde sobre eso.',
  ].join('\n');
}
