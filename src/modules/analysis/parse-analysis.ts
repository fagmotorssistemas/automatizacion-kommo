import {
  isSeguimientoEstado,
  type SeguimientoEstado,
} from '../followup/followup.constants';
import { isObjecionTipo, ObjecionTipo } from './objecion';

export type FormaPago = 'contado' | 'credito';

export type ConversationReading = {
  objecionPrincipal: ObjecionTipo | null;
  objecionTexto: string;
  objecionEvidencia: string;
  agendoVisita: boolean;
  resumen: string;
  presupuestoDeclarado: string | null;
  presupuestoMonto: number | null;
  entradaDisponible: number | null;
  formaPago: FormaPago | null;
  seguimiento: SeguimientoEstado;
};

function asMoney(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.round(n * 100) / 100;
}

function asFormaPago(value: unknown): FormaPago | null {
  return value === 'contado' || value === 'credito' ? value : null;
}

export function parseConversationReading(raw: unknown): ConversationReading | null {
  const row =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!row) {
    return null;
  }

  const rawObjecion = row.objecion_principal;
  const objecion =
    rawObjecion == null || rawObjecion === ''
      ? null
      : String(rawObjecion);
  const resumen = String(row.resumen ?? '').trim();
  const evidencia = String(row.objecion_evidencia ?? '').trim();
  if (!resumen) {
    return null;
  }
  if (objecion !== null && !isObjecionTipo(objecion)) {
    return null;
  }
  if (objecion && !evidencia) {
    return null;
  }

  const presupuesto = String(row.presupuesto_declarado ?? '').trim();
  const rawSeguimiento = String(row.seguimiento ?? 'activo').trim();
  const seguimiento = isSeguimientoEstado(rawSeguimiento)
    ? rawSeguimiento
    : 'activo';

  return {
    objecionPrincipal: objecion,
    objecionTexto: String(row.objecion_texto ?? '').trim(),
    objecionEvidencia: evidencia,
    agendoVisita: row.agendo_visita === true,
    resumen,
    presupuestoDeclarado: presupuesto || null,
    presupuestoMonto: asMoney(row.presupuesto_monto),
    entradaDisponible: asMoney(row.entrada_disponible),
    formaPago: asFormaPago(row.forma_pago),
    seguimiento,
  };
}
