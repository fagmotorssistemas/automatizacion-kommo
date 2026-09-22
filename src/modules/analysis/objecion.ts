export const OBJECION_TIPOS = [
  'precio',
  'entrada',
  'rechaza_credito',
  'retoma',
  'modelo',
  'equipamiento',
  'km',
  'solo_cotiza',
  'ubicacion',
  'ya_compro',
  'sin_conversacion',
  'no_responde',
  'sin_cierre',
  'numero_equivocado',
  'fuera_territorio',
  'otro',
] as const;

export type ObjecionTipo = (typeof OBJECION_TIPOS)[number];

export function isObjecionTipo(value: string): value is ObjecionTipo {
  return (OBJECION_TIPOS as readonly string[]).includes(value);
}

/** Cada objeción exige haber llegado a esta etapa. Si no, no se guarda. */
export const ETAPA_MINIMA_OBJECION: Record<ObjecionTipo, number> = {
  sin_conversacion: 0,
  no_responde: 0,
  numero_equivocado: 0,
  fuera_territorio: 0,
  otro: 0,
  modelo: 2,
  equipamiento: 2,
  km: 2,
  ubicacion: 2,
  ya_compro: 2,
  precio: 3,
  solo_cotiza: 3,
  sin_cierre: 3,
  entrada: 4,
  rechaza_credito: 4,
  retoma: 4,
};

const PROCESO_NO_OBJECION = new Set<ObjecionTipo>([
  'sin_cierre',
  'sin_conversacion',
  'no_responde',
]);

export function objecionParaGuardar(
  objecion: ObjecionTipo | null,
  etapa: number,
  texto: string,
  agendoVisita = false,
): { objecion: ObjecionTipo | null; texto: string } {
  if (!objecion) {
    return { objecion: null, texto };
  }
  if (agendoVisita && PROCESO_NO_OBJECION.has(objecion)) {
    return { objecion: null, texto: '' };
  }
  if (objecion === 'sin_conversacion' && etapa >= 1) {
    return { objecion: 'no_responde', texto };
  }
  if (etapa >= ETAPA_MINIMA_OBJECION[objecion]) {
    return { objecion, texto };
  }
  const nota = `[revisar:${objecion}]`;
  const original = texto.trim();
  return {
    objecion: 'otro',
    texto: original.startsWith(nota) ? original : `${nota} ${original}`.trim(),
  };
}
