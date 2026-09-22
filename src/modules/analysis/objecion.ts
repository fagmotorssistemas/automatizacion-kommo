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
