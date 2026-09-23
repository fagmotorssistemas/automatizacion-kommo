export type PromptSection = {
  name: string;
  content: string;
};

/** Code in JavaScript3: rol primero, luego el resto. */
export function assembleDynamicContext(sections: PromptSection[]): string {
  const valid = sections.filter((item) => item.name && item.content);
  valid.sort((a, b) => {
    if (a.name === 'rol') {
      return -1;
    }
    if (b.name === 'rol') {
      return 1;
    }
    return 0;
  });

  return valid
    .map((sec) => `\n# ${sec.name.toUpperCase()}\n${sec.content}\n`)
    .join('');
}

export function normalizeIntentName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-]+/g, '')
    .trim();
}

/** Nombres del clasificador → filas de agent_prompts. */
const INTENT_PROMPT_ALIAS: Record<string, string> = {
  reglasvehiculares: 'reglasvehiculos',
  curriculo: 'curriculum',
  hojadevida: 'curriculum',
};

export const OBJECTION_PROMPT_NAMES = [
  'objeciones',
  'manejocaro',
  'presupuestocliente',
] as const;

export function allowedPromptNames(dbNames: string[]): Set<string> {
  return new Set(
    dbNames.map((name) => normalizeIntentName(name.trim())).filter(Boolean),
  );
}

export function promptNamesFromIntents(
  intents: string[],
  dbNames?: string[] | null,
): string[] {
  const allow = dbNames?.length ? allowedPromptNames(dbNames) : null;
  const names = new Set<string>(['rol']);
  for (const intent of intents) {
    const clean = normalizeIntentName(intent);
    const mapped = INTENT_PROMPT_ALIAS[clean] ?? clean;
    if (!mapped) {
      continue;
    }
    if (allow && mapped !== 'rol' && !allow.has(mapped)) {
      continue;
    }
    names.add(mapped);
  }
  return [...names];
}

/** El .in() de Supabase usa el name tal cual está en patio (a veces con espacio). */
export function toFetchPromptNames(
  names: string[],
  dbNames: string[] | null | undefined,
): string[] {
  if (!dbNames?.length) {
    return names;
  }
  const byNorm = new Map<string, string[]>();
  for (const raw of dbNames) {
    const key = normalizeIntentName(raw.trim());
    if (!key) {
      continue;
    }
    const list = byNorm.get(key) ?? [];
    list.push(raw);
    byNorm.set(key, list);
  }
  const out: string[] = [];
  for (const name of names) {
    const hits = byNorm.get(normalizeIntentName(name));
    if (hits?.length) {
      out.push(...hits);
    } else if (name === 'rol') {
      out.push('rol');
    }
  }
  return [...new Set(out)];
}

/** Hechos del hilo para el clasificador: qué regla cargar, no el texto crudo. */
export function buildIntentsInput(input: {
  resumen: string;
  stayOnShown: boolean;
  fichaAlreadyGiven: boolean;
  askedPrice: boolean;
  priceObjection: boolean;
}): string {
  const pidePrecio = input.askedPrice && !input.priceObjection;
  return `${input.resumen.trim()}

CONTEXTO MASTICADO (hechos del hilo; no inventes):
Unidad en hilo: ${input.stayOnShown ? 'sí' : 'no'}
Ficha ya presentada: ${input.fichaAlreadyGiven ? 'sí' : 'no'}
Pide el precio: ${pidePrecio ? 'sí' : 'no'}
Objeta el valor: ${input.priceObjection ? 'sí' : 'no'}

Elige las filas de agent_prompts según este contexto y la solicitud. Nombres exactos, sin guion bajo.`;
}

export function parseIntentsPayload(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as { intenciones?: unknown };
    if (!Array.isArray(parsed.intenciones)) {
      return [];
    }
    return parsed.intenciones.filter((item): item is string => typeof item === 'string');
  } catch {
    const start = raw.indexOf('{');
    if (start === -1) {
      return [];
    }
    try {
      return parseIntentsPayload(raw.slice(start));
    } catch {
      return [];
    }
  }
}
