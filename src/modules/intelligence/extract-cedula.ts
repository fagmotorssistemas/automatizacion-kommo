/** Cédula ecuatoriana: 10 dígitos, provincia 01-24. No es celular (09…). */
export function extractCedula(text: string): string | null {
  const matches = text.match(/(?<!\d)\d{10}(?!\d)/g) ?? [];
  for (const value of matches) {
    if (value.startsWith('09')) {
      continue;
    }
    const province = Number(value.slice(0, 2));
    if (province >= 1 && province <= 24) {
      return value;
    }
  }
  return null;
}
