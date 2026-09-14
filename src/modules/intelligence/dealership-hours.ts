export const DEALERSHIP_TIMEZONE = 'America/Guayaquil';

export type DealershipClock = {
  mensaje: string;
  puedeVenirHoy: boolean;
  estaAbierto: boolean;
  horaActual: string;
  diaActual: number;
  diaNombre: string;
};

const WEEKDAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function partsInGuayaquil(now: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DEALERSHIP_TIMEZONE,
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    fmt.formatToParts(now).find((part) => part.type === type)?.value ?? '';

  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    get('weekday')
  ];

  return {
    diaActual: weekday ?? 0,
    mes: Number(get('month')) - 1,
    diaDelMes: Number(get('day')),
    hora: Number(get('hour') === '24' ? '0' : get('hour')),
    minuto: Number(get('minute')),
  };
}

/** fechaactual de n8n. Horarios en config, no en el prompt del agente. */
export function getDealershipClock(now = new Date()): DealershipClock {
  const { diaActual, mes, diaDelMes, hora, minuto } = partsInGuayaquil(now);
  const minutos = hora * 60 + minuto;
  const horaActual = `${hora}:${minuto.toString().padStart(2, '0')}`;
  const base = {
    horaActual,
    diaActual,
    diaNombre: WEEKDAY[diaActual] ?? '',
  };

  if (mes === 11 && diaDelMes === 25) {
    return {
      ...base,
      mensaje: '¿Desea venir el 26 de diciembre?',
      puedeVenirHoy: false,
      estaAbierto: false,
    };
  }

  if (diaActual === 0) {
    return {
      ...base,
      mensaje: '¿Desea venir mañana lunes?',
      puedeVenirHoy: false,
      estaAbierto: false,
    };
  }

  if (diaActual === 6) {
    const open = 9 * 60 + 30;
    const close = 13 * 60 + 30;
    if (minutos < open) {
      return {
        ...base,
        mensaje:
          minutos < 7 * 60
            ? '¿Desea venir más tarde hoy sábado o el lunes?'
            : '¿Desea venir hoy sábado o el lunes?',
        puedeVenirHoy: true,
        estaAbierto: false,
      };
    }
    if (minutos < close) {
      return {
        ...base,
        mensaje: '¿Desea venir hoy sábado o el lunes?',
        puedeVenirHoy: true,
        estaAbierto: true,
      };
    }
    return {
      ...base,
      mensaje: '¿Desea venir el lunes?',
      puedeVenirHoy: false,
      estaAbierto: false,
    };
  }

  const open = 8 * 60 + 30;
  const close = 18 * 60;
  if (minutos < open) {
    return {
      ...base,
      mensaje:
        minutos < 7 * 60
          ? '¿Desea venir más tarde hoy o mañana?'
          : '¿Desea venir hoy o mañana?',
      puedeVenirHoy: true,
      estaAbierto: false,
    };
  }
  if (minutos < close) {
    return {
      ...base,
      mensaje: '¿Desea venir hoy o mañana?',
      puedeVenirHoy: true,
      estaAbierto: true,
    };
  }
  return {
    ...base,
    mensaje:
      diaActual === 5 ? '¿Desea venir el lunes?' : '¿Desea venir mañana?',
    puedeVenirHoy: false,
    estaAbierto: false,
  };
}
