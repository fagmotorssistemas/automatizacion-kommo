import { modelFamily, StockCar } from './clasificar-filas';

export const COMPLIANCE_SYSTEM_PROMPT = `Eres el revisor de inventario de una concesionaria. Decides qué vehículos CUMPLEN el pedido del cliente.

REGLAS:
- Solo puedes usar los vehículos del JSON. No inventes carros ni ids.
- cumple únicamente si los datos de ESA unidad, o el modelo, año y versión exactos, confirman el pedido.
- Si no estás seguro, no cumple. No uses "tal vez".
- "5p" o "4p" en el modelo son puertas, no pasajeros.
- Pasajeros, filas, transmisión, combustible, tracción, techo y color se juzgan con la ficha del patio y, si viene, con fichas_tecnicas.
- Si fichas_tecnicas trae seguro=true, ese dato es un hecho de la ficha técnica de ese modelo y año. Si confirma el pedido, cumple. No lo trates como duda.
- Si seguro=false o el dato es "no consta", y la ficha del patio tampoco lo trae, no cumple. No pongas en duda a los que sí tienen ficha confirmada.
- El chasis es solo para distinguir la unidad. No lo repitas en la respuesta.
- plate_short solo si el cliente preguntó por la placa. No inventes ni completes la placa larga.
- Devuelve JSON válido y nada más:
{"cumplen":["id"],"parecidos":["id"],"no_cumplen":["id"]}
- cumplen: solo los que sí cumplen. Si ninguno cumple, va vacío.
- parecidos: si ninguno cumple, hasta 3 de ESTA misma marca que más se acercan (año, versión, tipo). Si la lista de vehículos no está vacía, parecidos NO puede ir vacío: elige los más cercanos.
- no_cumplen: el resto.`;

export type ComplianceReview = {
  cumplen: string[];
  noCumplen: string[];
  parecidos: string[];
};

export function carsForReview(cars: StockCar[]): Record<string, unknown>[] {
  return cars.map((car) => {
    const row: Record<string, unknown> = {
      id: car.id,
      marca: car.brand,
      modelo: car.model,
    };
    const add = (key: string, value: unknown) => {
      if (value === null || value === undefined || value === '') {
        return;
      }
      row[key] = value;
    };
    add('anio', car.year);
    add('version', car.version);
    add('color', car.color);
    add('precio', car.price);
    add('km', car.mileage);
    add('carroceria', car.typeBody);
    add('pasajeros', car.passengerCapacity);
    add('puertas', car.doorsCount);
    add('transmision', car.transmission);
    add('combustible', car.fuelType);
    add('traccion', car.driveType);
    add('plate_short', car.plateShort);
    add('chasis', car.vin);
    return row;
  });
}

export function parseComplianceReview(
  raw: string | null,
  allowedIds: string[],
): ComplianceReview | null {
  if (!raw?.trim() || allowedIds.length === 0) {
    return null;
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || !('cumplen' in parsed)) {
    return null;
  }

  const cumplenRaw = (parsed as { cumplen?: unknown }).cumplen;
  if (!Array.isArray(cumplenRaw)) {
    return null;
  }

  const allowed = new Set(allowedIds);
  const cumplen: string[] = [];
  for (const id of cumplenRaw) {
    const value = String(id);
    if (allowed.has(value) && !cumplen.includes(value)) {
      cumplen.push(value);
    }
  }

  const parecidosRaw = (parsed as { parecidos?: unknown }).parecidos;
  const parecidos: string[] = [];
  if (Array.isArray(parecidosRaw)) {
    for (const id of parecidosRaw) {
      const value = String(id);
      if (
        allowed.has(value) &&
        !cumplen.includes(value) &&
        !parecidos.includes(value)
      ) {
        parecidos.push(value);
      }
      if (parecidos.length === 3) {
        break;
      }
    }
  }

  const offered = new Set([...cumplen, ...parecidos]);
  return {
    cumplen,
    parecidos,
    noCumplen: allowedIds.filter((id) => !offered.has(id)),
  };
}

export function idsToOffer(
  review: ComplianceReview,
  allowSimilar = true,
): string[] {
  if (review.cumplen.length > 0) {
    return review.cumplen;
  }
  if (!allowSimilar) {
    return [];
  }
  return review.parecidos;
}

function label(car: StockCar, includePrice = false): string {
  const family = modelFamily(car.model);
  const name =
    family === 'xtrail'
      ? 'X-Trail'
      : family
        ? family.charAt(0).toUpperCase() + family.slice(1)
        : car.model;
  const year = car.year ? ` ${car.year}` : '';
  const price =
    includePrice && car.price && car.price > 0
      ? `, $${Math.round(car.price)}`
      : '';
  return `${name}${year}${price} (inventory_id=${car.id})`;
}

export function formatComplianceForAgent(
  ask: string,
  cars: StockCar[],
  review: ComplianceReview,
  includePrice = false,
): string {
  const byId = new Map(cars.map((car) => [car.id, car]));
  const line = (id: string) => {
    const car = byId.get(id);
    return car ? label(car, includePrice) : id;
  };
  const no = review.noCumplen.map(line).join('; ');
  const parts = [`REVISIÓN DEL PEDIDO: ${ask}`];

  if (review.cumplen.length === 0 && review.parecidos.length > 0) {
    const closest = review.parecidos.map(line).join('\n');
    if (review.parecidos.length === 1) {
      const id = review.parecidos[0];
      parts.push(`Ninguno cumple exacto. PRIMERO dilo: no tenemos lo que pidió. DESPUÉS ofrece lo más parecido de esta marca, y hay que mandarlo: ${line(id)}.`);
      parts.push(
        `No lo presentes como si fuera el pedido. En meta.vehiculo.inventory_id pon exactamente "${id}".`,
      );
      const near = byId.get(id);
      if (!near?.botId) {
        parts.push(
          'Este carro no tiene bot_id de fotos: no hay fotos para enviar. Díselo al cliente.',
        );
      }
    } else {
      parts.push(
        'Ninguno cumple exacto. Estos son los más parecidos de esta marca. Nómbralos para que elija uno. vehiculo null.',
      );
      parts.push(closest);
    }
    parts.push('No pases a otra marca: todavía hay parecidos de esta.');
    return parts.join('\n');
  }

  if (review.cumplen.length === 0) {
    if (cars.length > 0) {
      parts.push(
        'Ninguno cumple exacto. Ofrece lo más cercano de ESTA misma marca (de la lista revisada). Nómbralos para que elija. No pases a otra marca todavía.',
      );
      parts.push(
        `En patio de esta marca: ${cars.map((car) => label(car, includePrice)).join('; ')}.`,
      );
      parts.push('vehiculo null hasta que elija uno.');
    } else {
      parts.push('No hay stock de esta marca en patio. Díselo y pregunta si quiere ver otra línea. No inventes carros. vehiculo null.');
    }
    return parts.join('\n');
  }

  if (review.cumplen.length === 1) {
    const id = review.cumplen[0];
    const car = byId.get(id);
    parts.push(`Cumple uno solo y hay que enviarlo: ${line(id)}.`);
    parts.push(`En meta.vehiculo.inventory_id pon exactamente "${id}".`);
    if (!car?.botId) {
      parts.push(
        'Este carro no tiene bot_id de fotos en inventario: no hay fotos para enviar. Díselo claro al cliente (sin inventar que ya se las mandaste).',
      );
    }
    if (no) {
      parts.push(`No cumplen, no los ofrezcas: ${no}.`);
    }
    return parts.join('\n');
  }

  parts.push(
    'Cumplen varios. Nómbralos todos para que elija uno, aunque pase de 2 líneas. No mandes fotos todavía: vehiculo null.',
  );
  parts.push(review.cumplen.map(line).join('\n'));
  if (no) {
    parts.push(`No cumplen, no los ofrezcas: ${no}.`);
  }
  parts.push('No cambies de marca.');
  return parts.join('\n');
}

export function formatOtherBrands(
  ask: string,
  brand: string,
  cars: StockCar[],
  review: ComplianceReview,
  includePrice = false,
): string {
  const byId = new Map(cars.map((car) => [car.id, car]));
  const line = (id: string) => {
    const car = byId.get(id);
    return car ? `${car.brand} ${label(car, includePrice)}` : id;
  };
  const parts = [
    `De ${brand} ninguno cumple ni se acerca.`,
    `PEDIDO: ${ask}`,
  ];

  if (review.cumplen.length === 0) {
    parts.push(
      'Tampoco hay otra marca en inventario que cumpla. Dilo y pregunta qué otro requisito le sirve. No cierres la conversación. vehiculo null.',
    );
    return parts.join('\n');
  }

  if (review.cumplen.length === 1) {
    const id = review.cumplen[0];
    parts.push(`Esta otra unidad sí cumple y hay que mandarla: ${line(id)}.`);
    parts.push(`En meta.vehiculo.inventory_id pon exactamente "${id}".`);
    return parts.join('\n');
  }

  parts.push(
    'Estas otras marcas sí cumplen. Nómbralas para que elija una. vehiculo null.',
  );
  parts.push(review.cumplen.map(line).join('\n'));
  return parts.join('\n');
}

/** Un solo carro de la oferta se envía. Si hay varios, solo el que el cliente ya nombró. */
export function vehicleToSend(
  review: ComplianceReview,
  namedId: string | null,
  allowSimilar = true,
): string | null {
  const offer = idsToOffer(review, allowSimilar);
  if (offer.length === 1) {
    return offer[0];
  }
  if (namedId && offer.includes(namedId)) {
    return namedId;
  }
  return null;
}
