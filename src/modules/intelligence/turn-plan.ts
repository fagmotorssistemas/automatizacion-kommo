import type { InterestedCarSnapshot } from '../persistence/lead.types';
import type { VehicleLexicon } from '../conversation/fuzzy-vehicle-name';
import { leftShownCar } from '../conversation/interested-car';
import { resumenBrandFitsShown } from '../conversation/named-this-turn';
import {
  detectBrand,
  detectNamedModelAsk,
  type NamedModelAsk,
} from '../conversation/vehicle-brand';
import type { VehicleKind } from '../conversation/vehicle-kind';
import {
  resumenAceptaCredito,
  resumenAsientos,
  resumenAsksForCredit,
  resumenAsksForListedPrice,
  resumenAsksForLocation,
  resumenAsksForOtherColor,
  resumenAsksForPhotos,
  resumenCabina,
  resumenCajaCompra,
  resumenFaltaVehiculo,
  resumenHasPendingDoubt,
  resumenIsCourtesy,
  resumenIsFarewell,
  resumenIsThreadAck,
  resumenPideHorario,
  resumenPideNegociar,
  resumenPideOtras,
  resumenPideFicha,
  resumenStaysOnShownUnit,
  resumenTipoPatio,
  resumenTopeContado,
  resumenTresFilas,
  solicitudSinBanderas,
  vehicleClientePidio,
  vehicleQueSigue,
} from './parse-resumen';

/**
 * Qué hace el bot en ESTE turno. Se decide UNA vez, con lo que entendió el
 * resumen. Los ejecutores (reviewBrand, catálogo, agente de ventas) reciben
 * el plan y no vuelven a adivinar leyendo palabras sueltas del cliente.
 *
 * Orden de precedencia (el primero que aplica gana):
 *  1. CIERRE           se despide de verdad (sin duda pendiente)
 *  2. HORARIO          pregunta si atienden / horario
 *  3. ASIENTOS         pide un número de plazas
 *  4. VENTA_PROPIA     habla de vender su carro (lo dice quien llama, viene de intents)
 *  5. PEDIR_CARRO      no hay unidad y el resumen dice que falta el vehículo
 *  6. RESPALDO         el resumen no trae «Pide otras»: no se decide aquí,
 *                      el llamador usa el camino de siempre (texto)
 *  7. ELEGIR_DE_LISTA  el bot acaba de listar unidades y no pide otras
 *  8. SEGUIR_UNIDAD    sigue en la unidad ya mostrada
 *  9. OTRAS            busca otra unidad (lo que pide sale del resumen)
 *
 * Con el resumen no se lee el texto crudo del cliente: ni marca, ni modelo,
 * ni «gracias» como aceptar algo. Lo que necesite del texto (un número, un
 * «el primero») lo toma el ejecutor como dato, no como decisión.
 */
export type TurnAction =
  | 'CIERRE'
  | 'HORARIO'
  | 'ASIENTOS'
  | 'VENTA_PROPIA'
  | 'PEDIR_CARRO'
  | 'RESPALDO'
  | 'ELEGIR_DE_LISTA'
  | 'SEGUIR_UNIDAD'
  | 'OTRAS';

/** Sobre qué habla el cliente cuando sigue en la unidad. */
export type SeguirTema =
  | 'precio'
  | 'negociar'
  | 'ubicacion'
  | 'duda'
  | 'credito'
  | 'fotos'
  | 'ficha'
  | 'cortesia'
  | 'acuse'
  | 'seguimiento';

/** Lo que pide cuando busca otra unidad. Todo sale del resumen. */
export type PedidoOtras = {
  /** Marca que nombra el propio resumen (solicitud + vehículo). */
  marca: string | null;
  /** Modelo que nombra el propio resumen. */
  modelo: NamedModelAsk | null;
  tipo: VehicleKind | 'no' | null;
  caja: 'manual' | 'automatica' | 'no' | null;
  cabina: 'cs' | 'cd' | null;
  topeContado: number | null;
  tresFilas: boolean;
  otroColor: boolean;
};

export type TurnPlan = {
  accion: TurnAction;
  /** «resumen»: lo decidió el resumen. «respaldo»: faltó el flag, usa texto. */
  fuente: 'resumen' | 'respaldo';
  /** Vehículo vigente según el resumen (este turno o el anterior). */
  vehiculo: string | null;
  /** Solo en SEGUIR_UNIDAD. */
  seguir: SeguirTema[];
  /** Solo en OTRAS. */
  otras: PedidoOtras | null;
  /** Plazas que pide (ASIENTOS). */
  asientos: number | null;
  /** Por qué se eligió. Sirve para logs y para comparar con el camino viejo. */
  razon: string;
};

export type TurnPlanInput = {
  resumen: string;
  previousResumen?: string | null;
  lexicon: VehicleLexicon;
  /** Unidad ya mostrada en el hilo (interested_cars o la única del historial). */
  unidad: InterestedCarSnapshot | null;
  history?: { role: string; content: string }[];
  /** El último mensaje del bot fue un listado de unidades. */
  ultimoBotListo: boolean;
  /** Habla de vender su carro y no de comprar. Lo decide intents, no el texto. */
  ventaPropia?: boolean;
};

function seguirTemas(resumen: string): SeguirTema[] {
  const temas: SeguirTema[] = [];
  if (resumenPideNegociar(resumen)) {
    temas.push('negociar');
  } else if (resumenAsksForListedPrice(resumen)) {
    temas.push('precio');
  }
  if (resumenAsksForLocation(resumen)) {
    temas.push('ubicacion');
  }
  if (resumenHasPendingDoubt(resumen)) {
    temas.push('duda');
  }
  if (resumenAsksForCredit(resumen) || resumenAceptaCredito(resumen)) {
    temas.push('credito');
  }
  if (resumenAsksForPhotos(resumen)) {
    temas.push('fotos');
  }
  if (resumenPideFicha(resumen)) {
    temas.push('ficha');
  }
  if (temas.length > 0) {
    return temas;
  }
  if (resumenIsCourtesy(resumen)) {
    return ['cortesia'];
  }
  if (resumenIsThreadAck(resumen)) {
    return ['acuse'];
  }
  return ['seguimiento'];
}

function pedidoOtras(resumen: string, lexicon: VehicleLexicon): PedidoOtras {
  // Lo que pide AHORA está en la solicitud; el vehículo solo completa.
  const solicitud = solicitudSinBanderas(resumen) || resumen;
  const vehiculo = vehicleClientePidio(resumen) ?? '';
  return {
    marca: detectBrand(solicitud, lexicon) ?? detectBrand(vehiculo, lexicon),
    modelo:
      detectNamedModelAsk(solicitud, lexicon) ??
      detectNamedModelAsk(vehiculo, lexicon),
    tipo: resumenTipoPatio(resumen),
    caja: resumenCajaCompra(resumen),
    cabina: resumenCabina(resumen),
    topeContado: resumenTopeContado(resumen),
    tresFilas: resumenTresFilas(resumen),
    otroColor: resumenAsksForOtherColor(resumen),
  };
}

export function buildTurnPlan(input: TurnPlanInput): TurnPlan {
  const { resumen, lexicon, unidad } = input;
  const vehiculo = vehicleQueSigue(resumen, input.previousResumen ?? null);
  const base = {
    vehiculo,
    seguir: [] as SeguirTema[],
    otras: null as PedidoOtras | null,
    asientos: null as number | null,
  };
  const plan = (
    accion: TurnAction,
    razon: string,
    extra: Partial<TurnPlan> = {},
  ): TurnPlan => ({
    ...base,
    accion,
    fuente: accion === 'RESPALDO' ? 'respaldo' : 'resumen',
    razon,
    ...extra,
  });

  if (resumenIsFarewell(resumen)) {
    return plan('CIERRE', 'Es despedida: sí, sin duda pendiente');
  }
  if (resumenPideHorario(resumen)) {
    return plan('HORARIO', 'Pide horario: sí');
  }
  const asientos = resumenAsientos(resumen);
  if (asientos != null && !resumenTresFilas(resumen)) {
    return plan('ASIENTOS', `Asientos: ${asientos}`, { asientos });
  }
  if (input.ventaPropia) {
    return plan('VENTA_PROPIA', 'Habla de vender su carro');
  }

  if (!unidad && resumenFaltaVehiculo(resumen)) {
    return plan('PEDIR_CARRO', 'Falta vehículo: sí y no hay unidad mostrada');
  }

  const pideOtras = resumenPideOtras(resumen)
    ? true
    : resumenStaysOnShownUnit(resumen)
      ? false
      : null;
  if (pideOtras === null) {
    return plan('RESPALDO', 'El resumen no trae «Pide otras»');
  }

  if (unidad && input.ultimoBotListo) {
    return pideOtras
      ? plan('OTRAS', 'Pide otras: sí tras un listado', {
          otras: pedidoOtras(resumen, lexicon),
        })
      : plan('ELEGIR_DE_LISTA', 'Pide otras: no tras un listado');
  }

  if (unidad) {
    if (pideOtras) {
      return plan('OTRAS', 'Pide otras: sí', {
        otras: pedidoOtras(resumen, lexicon),
      });
    }
    if (resumenFaltaVehiculo(resumen)) {
      return plan('PEDIR_CARRO', 'Pide otras: no pero Falta vehículo: sí');
    }
    if (!resumenBrandFitsShown(resumen, unidad.brand, lexicon)) {
      return plan('OTRAS', 'El resumen nombra otra marca que la mostrada', {
        otras: pedidoOtras(resumen, lexicon),
      });
    }
    const seFue = leftShownCar({
      text: '',
      resumen,
      history: input.history,
      car: unidad,
      lexicon,
      pedido: vehiculo,
    });
    if (seFue) {
      return plan('OTRAS', 'El resumen describe otra unidad que la mostrada', {
        otras: pedidoOtras(resumen, lexicon),
      });
    }
    return plan('SEGUIR_UNIDAD', 'Pide otras: no y sigue en la unidad', {
      seguir: seguirTemas(resumen),
    });
  }

  // Sin unidad mostrada
  if (pideOtras || vehiculo) {
    return plan('OTRAS', 'Sin unidad mostrada: busca lo que dice el resumen', {
      otras: pedidoOtras(resumen, lexicon),
    });
  }
  return plan(
    'RESPALDO',
    'Sin unidad, sin vehículo y sin «Falta vehículo»: ambiguo',
  );
}

/** Qué rama tomó el código de siempre en este turno. */
export type LegacyPath =
  | 'CIERRE'
  | 'HORARIO'
  | 'ASIENTOS'
  | 'VENTA_PROPIA'
  | 'PEDIR_CARRO'
  | 'SEGUIR_UNIDAD'
  | 'REVIEW_BRAND';

/** Lo que se guarda en automation_run_logs para comparar plan vs camino viejo. */
export type TurnPlanLog = {
  accion: TurnAction;
  fuente: 'resumen' | 'respaldo';
  razon: string;
  caminoViejo: LegacyPath;
  /** true: coinciden. false: difieren. null: el plan no decidió (RESPALDO). */
  coincide: boolean | null;
};

/**
 * El camino viejo no separa OTRAS / ELEGIR_DE_LISTA / PEDIR_CARRO: todo eso
 * pasa por reviewBrand. Se comparan por familia.
 */
export function planCoincideConCaminoViejo(
  accion: TurnAction,
  caminoViejo: LegacyPath,
): boolean | null {
  switch (accion) {
    case 'RESPALDO':
      return null;
    case 'OTRAS':
    case 'ELEGIR_DE_LISTA':
      return caminoViejo === 'REVIEW_BRAND';
    case 'PEDIR_CARRO':
      return caminoViejo === 'PEDIR_CARRO' || caminoViejo === 'REVIEW_BRAND';
    default:
      return accion === caminoViejo;
  }
}

export function turnPlanLog(plan: TurnPlan, caminoViejo: LegacyPath): TurnPlanLog {
  return {
    accion: plan.accion,
    fuente: plan.fuente,
    razon: plan.razon,
    caminoViejo,
    coincide: planCoincideConCaminoViejo(plan.accion, caminoViejo),
  };
}
