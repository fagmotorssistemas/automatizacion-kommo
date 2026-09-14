const MAX_PREFIXES = 4;

/** Parsear_img-prefix: string o array → máximo 4 slugs limpios. */
export function parseImgPrefixes(value: unknown): string[] {
  const raw: string[] = [];

  if (Array.isArray(value)) {
    raw.push(...value.map((item) => String(item ?? '')));
  } else if (typeof value === 'string' && value.trim()) {
    raw.push(value);
  }

  const unique = new Set<string>();
  for (const item of raw) {
    const prefix = item.trim();
    if (prefix) {
      unique.add(prefix);
    }
  }

  return [...unique].slice(0, MAX_PREFIXES);
}
