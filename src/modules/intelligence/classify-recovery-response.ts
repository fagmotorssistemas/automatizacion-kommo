import { RecoveryStep } from '../persistence/lead.types';

export const RECOVERY_STEPS: RecoveryStep[] = ['2d', '7d', '15d', '30d'];

export type RecoveryClassification = {
  value: string;
  confidence: number;
  matched: string[];
  stop: boolean;
};

export type RecoveryWrite = {
  step: RecoveryStep;
  classification: RecoveryClassification;
  textRaw: string;
};

function normalizeText(value = ''): string {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s?]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function matchAnyRegex(text: string, regexList: RegExp[]): boolean {
  return regexList.some((regex) => regex.test(text));
}

/** parcear_respuestas: clasifica la respuesta a un follow-up 2d/7d/15d/30d. */
export function classifyRecoveryResponse(messageRaw: string): RecoveryClassification {
  const raw = String(messageRaw ?? '').trim();
  const hasQuestion = raw.includes('?');
  const text = normalizeText(raw);

  if (!text || text.length < 2) {
    return { value: 'no_hubo_respuesta', confidence: 1, matched: ['empty'], stop: false };
  }

  const noMolesten = [
    'no me escriba',
    'no me escribas',
    'no me llames',
    'no llamar',
    'no moleste',
    'no molestes',
    'deja de escribir',
    'dejen de escribir',
    'no insistas',
    'no jodas',
    'no fastidie',
    'no fastidies',
    'no quiero que me contacten',
    'no me contacten',
    'no mas mensajes',
    'borra mi numero',
    'elimina mi numero',
    'no deseo recibir mensajes',
    'stop',
    'unsubscribe',
    'baja',
    'no me vuelva a escribir',
    'no vuelvas a escribir',
  ];
  if (includesAny(text, noMolesten)) {
    return { value: 'no_molesten', confidence: 0.95, matched: ['no_molesten'], stop: true };
  }

  const yaCompro = [
    'ya compre',
    'ya lo compre',
    'ya compre otro',
    'ya compre uno',
    'ya compre en otro lado',
    'ya tengo carro',
    'ya tengo auto',
    'ya tengo vehiculo',
    'ya consegui',
    'ya lo consegui',
    'ya resolvi',
    'ya lo resolvi',
    'ya hice la compra',
    'ya lo adquiri',
    'ya adquiri',
    'ya tengo uno',
    'ya lo tengo',
  ];
  if (includesAny(text, yaCompro)) {
    return { value: 'ya_compro', confidence: 0.9, matched: ['ya_compro'], stop: true };
  }

  const pospone = [
    'a la proxima',
    'la proxima',
    'luego',
    'despues',
    'mas tarde',
    'otro dia',
    'en otro momento',
    'manana',
    'en la tarde',
    'en la noche',
    'esta semana',
    'la proxima semana',
    'ahorita no puedo',
    'no puedo ahora',
    'no puedo en este momento',
    'te llamo',
    'yo te llamo',
    'le llamo',
    'yo le llamo',
    'te escribo',
    'yo te escribo',
    'te aviso',
    'yo te aviso',
  ];
  const posponeRegex = [
    /\b(la\s+proxima|a\s+la\s+proxima)\b/,
    /\b(luego|despues|mas\s+tarde)\b/,
    /\b(otro\s+dia|en\s+otro\s+momento)\b/,
    /\b(manana)\b/,
    /\b(te\s+llamo|yo\s+te\s+llamo|le\s+llamo|yo\s+le\s+llamo)\b/,
  ];
  if (includesAny(text, pospone) || matchAnyRegex(text, posponeRegex)) {
    return {
      value: 'continua_conversacion',
      confidence: 0.85,
      matched: ['pospone_luego'],
      stop: false,
    };
  }

  const noInteresa = [
    'no gracias',
    'gracias no',
    'no me interesa',
    'no estoy interesado',
    'no estoy interesada',
    'no deseo',
    'no quiero',
    'no por ahora',
    'ya no',
    'paso',
    'en este momento no',
    'no busco',
    'no ando buscando',
    'no me sirve',
    'no me conviene',
  ];
  const strongNoInteresa = [
    /\bno\s+gracias\b/,
    /\bgracias\s+no\b/,
    /\bno\s+me\s+interes(a|an)\b/,
    /\bno\s+quiero\b/,
    /\bno\s+deseo\b/,
    /\bpor\s+ahora\s+no\b/,
  ];
  if (matchAnyRegex(text, strongNoInteresa) || includesAny(text, noInteresa)) {
    return {
      value: 'no_le_interesa',
      confidence: 0.82,
      matched: ['no_le_interesa'],
      stop: false,
    };
  }

  const continuePhrases = [
    'precio',
    'cuanto cuesta',
    'valor',
    'disponible',
    'financiamiento',
    'credito',
    'entrada',
    'cuota',
    'mensualidad',
    'garantia',
    'ubicacion',
    'direccion',
    'horario',
    'puedo ver',
    'quiero ver',
    'me interesa',
    'info',
    'informacion',
    'detalles',
    'fotos',
    'ok',
    'dale',
    'si',
    'listo',
    'envia',
    'mandame',
    'llamame',
    'hola',
    'buenas',
    'cuando',
    'donde',
  ];
  if (hasQuestion || includesAny(text, continuePhrases)) {
    return {
      value: 'continua_conversacion',
      confidence: 0.78,
      matched: ['continua'],
      stop: false,
    };
  }

  return {
    value: 'no_hubo_respuesta',
    confidence: 0.55,
    matched: ['default'],
    stop: false,
  };
}

export function latestRecoveryStep(mensajesEnviados: string[]): RecoveryStep | null {
  return (
    [...mensajesEnviados]
      .reverse()
      .find((item): item is RecoveryStep =>
        RECOVERY_STEPS.includes(item as RecoveryStep),
      ) ?? null
  );
}

export function planRecoveryWrite(input: {
  mensajesEnviados?: string[] | null;
  message: string;
}): RecoveryWrite | null {
  const step = latestRecoveryStep(input.mensajesEnviados ?? []);
  if (!step) {
    return null;
  }

  const classification = classifyRecoveryResponse(input.message);
  return {
    step,
    classification,
    textRaw: String(input.message ?? ''),
  };
}
