export type OrigenUnidad =
  | 'interested'
  | 'ficha'
  | 'lista'
  | 'alternativas_caja'
  | 'tool';

export type UnidadContexto = {
  id: string;
  origen: OrigenUnidad;
};

/** Ids y origen de las unidades cuya ficha o datos entraron al modelo en el turno. */
export function armarUnidadesContexto(input: {
  interestedText?: string;
  interestedId?: string | null;
  sendId?: string | null;
  listedIds?: string[];
  contextOrigin?: 'alternativas_caja';
  contextIds?: string[];
  toolIds?: string[];
}): UnidadContexto[] {
  const rows: UnidadContexto[] = [];
  const seen = new Set<string>();
  const add = (id: string | null | undefined, origen: OrigenUnidad) => {
    const clean = id?.trim();
    if (!clean) {
      return;
    }
    const key = `${origen}:${clean}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push({ id: clean, origen });
  };

  if (input.interestedText?.trim() && input.interestedId) {
    add(input.interestedId, 'interested');
  }

  if (input.contextOrigin === 'alternativas_caja') {
    for (const id of input.contextIds ?? []) {
      add(id, 'alternativas_caja');
    }
    add(input.sendId, 'alternativas_caja');
  } else if ((input.listedIds?.length ?? 0) > 1) {
    for (const id of input.listedIds ?? []) {
      add(id, 'lista');
    }
  } else if (input.sendId) {
    add(input.sendId, 'ficha');
  } else if (input.listedIds?.length === 1) {
    add(input.listedIds[0], 'ficha');
  }

  for (const id of input.toolIds ?? []) {
    add(id, 'tool');
  }
  return rows;
}
