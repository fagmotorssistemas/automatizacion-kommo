import { DEALERSHIP_TIMEZONE } from '../intelligence/dealership-hours';

/** Minutos abiertos por día (America/Guayaquil). Dom = 0. */
const OPEN_MINUTES: Array<{ open: number; close: number } | null> = [
  null, // domingo
  { open: 8 * 60 + 30, close: 18 * 60 }, // lun
  { open: 8 * 60 + 30, close: 18 * 60 },
  { open: 8 * 60 + 30, close: 18 * 60 },
  { open: 8 * 60 + 30, close: 18 * 60 },
  { open: 8 * 60 + 30, close: 18 * 60 }, // vie
  { open: 9 * 60 + 30, close: 13 * 60 + 30 }, // sáb
];

type LocalParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutes: number;
};

function localParts(date: Date): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DEALERSHIP_TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    fmt.formatToParts(date).find((part) => part.type === type)?.value ?? '';

  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    get('weekday')
  ];
  const hour = Number(get('hour') === '24' ? '0' : get('hour'));
  const minute = Number(get('minute'));

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: weekday ?? 0,
    minutes: hour * 60 + minute,
  };
}

/** Instante UTC que corresponde a esa fecha/minuto local en Guayaquil. */
function atLocal(year: number, month: number, day: number, minutes: number): Date {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  // Guayaquil es UTC-5 sin DST
  return new Date(`${iso}-05:00`);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number; weekday: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  const y = utc.getUTCFullYear();
  const m = utc.getUTCMonth() + 1;
  const d = utc.getUTCDate();
  const weekday = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-05:00`).getDay();
  return { year: y, month: m, day: d, weekday };
}

/**
 * Avanza `hours` solo en ventanas laborales (L–V 08:30–18:00, Sáb 09:30–13:30).
 * Dom y fuera de horario no suman. El envío sí puede caer sáb/dom.
 */
export function addBusinessHours(from: Date, hours: number): Date {
  let remaining = Math.max(0, hours) * 60;
  if (remaining === 0) {
    return new Date(from);
  }

  let cursor = new Date(from);
  // Tope de seguridad: ~60 días de avance
  for (let guard = 0; guard < 60 * 24 * 60 && remaining > 0; guard += 1) {
    const parts = localParts(cursor);
    const window = OPEN_MINUTES[parts.weekday];

    if (!window || parts.minutes >= window.close) {
      const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
      let day = next;
      for (let i = 0; i < 8; i += 1) {
        const w = OPEN_MINUTES[day.weekday];
        if (w) {
          cursor = atLocal(day.year, day.month, day.day, w.open);
          break;
        }
        day = addCalendarDays(day.year, day.month, day.day, 1);
      }
      continue;
    }

    if (parts.minutes < window.open) {
      cursor = atLocal(parts.year, parts.month, parts.day, window.open);
      continue;
    }

    const available = window.close - parts.minutes;
    if (remaining <= available) {
      return atLocal(
        parts.year,
        parts.month,
        parts.day,
        parts.minutes + remaining,
      );
    }

    remaining -= available;
    const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
    let day = next;
    for (let i = 0; i < 8; i += 1) {
      const w = OPEN_MINUTES[day.weekday];
      if (w) {
        cursor = atLocal(day.year, day.month, day.day, w.open);
        break;
      }
      day = addCalendarDays(day.year, day.month, day.day, 1);
    }
  }

  return cursor;
}

export function addCalendarDaysFrom(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Si cae fuera de horario (ej. 1:00 am), mueve al próximo inicio laboral. */
export function snapToBusinessOpen(date: Date): Date {
  const parts = localParts(date);
  const window = OPEN_MINUTES[parts.weekday];
  if (window && parts.minutes >= window.open && parts.minutes < window.close) {
    return new Date(date);
  }

  let day = { year: parts.year, month: parts.month, day: parts.day, weekday: parts.weekday };
  if (window && parts.minutes < window.open) {
    return atLocal(day.year, day.month, day.day, window.open);
  }

  day = addCalendarDays(day.year, day.month, day.day, 1);
  for (let i = 0; i < 8; i += 1) {
    const w = OPEN_MINUTES[day.weekday];
    if (w) {
      return atLocal(day.year, day.month, day.day, w.open);
    }
    day = addCalendarDays(day.year, day.month, day.day, 1);
  }
  return new Date(date);
}

/** Suma delay de reloj y, si queda fuera de patio, espera al próximo horario laboral. */
export function afterDelayInBusinessHours(from: Date, delayMs: number): Date {
  return snapToBusinessOpen(new Date(from.getTime() + Math.max(0, delayMs)));
}
