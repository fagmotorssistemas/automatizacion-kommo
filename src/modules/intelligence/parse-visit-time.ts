import { DEALERSHIP_TIMEZONE } from './dealership-hours';
import { VisitTimeHint } from './parse-lead-analysis';

export type ResolvedVisitTime = {
  day_detected: string | null;
  hour_detected: string | null;
  visit_datetime: string | null;
};

const PERIODS = [
  'manana',
  'la manana',
  'en la manana',
  'tarde',
  'la tarde',
  'en la tarde',
  'noche',
  'la noche',
  'en la noche',
];

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function toNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function nowInEcuador(now: Date): Date {
  return new Date(now.toLocaleString('en-US', { timeZone: DEALERSHIP_TIMEZONE }));
}

function formatDateYYYYMMDD(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEALERSHIP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function formatTimeHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseHourMinute(text: string): { hour: number; minute: number } | null {
  const normalized = normalizeText(text);
  const compact = normalized.replace(/[\s.]/g, '');
  const match = normalized.match(/(?:^|\b)(\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return null;
  }
  if (hour >= 13) {
    return { hour, minute };
  }

  const isPM = compact.includes('pm') || normalized.includes('tarde') || normalized.includes('noche');
  const isAM = compact.includes('am');
  if (isPM && hour < 12) {
    hour += 12;
  } else if (isAM && hour === 12) {
    hour = 0;
  } else if (!isPM && !isAM && hour >= 1 && hour <= 6) {
    hour += 12;
  }
  return { hour, minute };
}

function isValidDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function nextOccurrence(base: Date, weekday: number): Date {
  const next = new Date(base);
  let diff = weekday - next.getDay();
  if (diff <= 0) {
    diff += 7;
  }
  next.setDate(next.getDate() + diff);
  return next;
}

function nextDateForDayOfMonth(base: Date, day: number): Date | null {
  let year = base.getFullYear();
  let month = base.getMonth();
  const baseFloor = new Date(year, month, base.getDate());

  for (let i = 0; i < 14; i += 1) {
    const candidate = new Date(year, month, day);
    if (isValidDate(candidate) && candidate.getDate() === day) {
      const candFloor = new Date(
        candidate.getFullYear(),
        candidate.getMonth(),
        candidate.getDate(),
      );
      if (candFloor >= baseFloor) {
        return candidate;
      }
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return null;
}

type DayInfo =
  | { kind: 'iso'; value: string }
  | { kind: 'daymonth'; day: number; month: number }
  | { kind: 'dom'; day: number }
  | { kind: 'offset'; days: number }
  | { kind: 'weekday'; weekday: number };

function extractDayInfo(text: string): DayInfo | null {
  const normalized = normalizeText(text);
  const compact = normalized.replace(/\s+/g, '');

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return { kind: 'iso', value: normalized };
  }

  let match = normalized.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { kind: 'daymonth', day, month };
    }
  }

  if (/^\d{1,2}$/.test(normalized)) {
    const day = Number.parseInt(normalized, 10);
    if (day >= 1 && day <= 31) {
      return { kind: 'dom', day };
    }
  }

  match = normalized.match(/\b(?:dentro\s*de|en)\s*(\d{1,3})\s*(dia|dias)\b/);
  if (match) {
    return { kind: 'offset', days: Number.parseInt(match[1], 10) };
  }

  match = normalized.match(/\b(?:dentro\s*de|en)\s*(\d{1,3})\s*(semana|semanas)\b/);
  if (match) {
    return { kind: 'offset', days: Number.parseInt(match[1], 10) * 7 };
  }

  if (normalized.includes('pasado manana') || compact.includes('pasadomanana')) {
    return { kind: 'offset', days: 2 };
  }
  if (normalized.includes('manana')) {
    return { kind: 'offset', days: 1 };
  }
  if (normalized.includes('hoy')) {
    return { kind: 'offset', days: 0 };
  }

  const daysMap: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  };
  for (const [name, weekday] of Object.entries(daysMap)) {
    if (normalized.includes(name)) {
      return { kind: 'weekday', weekday };
    }
  }
  return null;
}

function resolveDay(dayInfo: DayInfo, nowEc: Date, fallback: string | null): string | null {
  if (dayInfo.kind === 'iso') {
    return dayInfo.value;
  }
  if (dayInfo.kind === 'offset') {
    return formatDateYYYYMMDD(addDays(nowEc, dayInfo.days));
  }
  if (dayInfo.kind === 'weekday') {
    return formatDateYYYYMMDD(nextOccurrence(nowEc, dayInfo.weekday));
  }
  if (dayInfo.kind === 'dom') {
    const date = nextDateForDayOfMonth(nowEc, dayInfo.day);
    return date ? formatDateYYYYMMDD(date) : fallback;
  }

  const base = new Date(nowEc);
  let year = base.getFullYear();
  let candidate = new Date(year, dayInfo.month - 1, dayInfo.day);
  const baseFloor = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const candFloor = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
  if (candFloor < baseFloor) {
    candidate = new Date(year + 1, dayInfo.month - 1, dayInfo.day);
  }
  return isValidDate(candidate) && candidate.getDate() === dayInfo.day
    ? formatDateYYYYMMDD(candidate)
    : fallback;
}

function padTimeToHHMMSS(value: string | null): string | null {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  if (/^\d{1,2}$/.test(text)) {
    return `${text.padStart(2, '0')}:00:00`;
  }
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    return `${text.padStart(5, '0')}:00`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) {
    return text.padStart(8, '0');
  }
  return null;
}

function dropPeriodHour(hour: string | null): string | null {
  if (!hour) {
    return hour;
  }
  const normalized = normalizeText(hour);
  return PERIODS.some((period) => normalized === period || normalized.includes(period))
    ? null
    : hour;
}

/** parsear_fecha + parsear_hora + Parsear Fecha. */
export function resolveVisitTime(
  hint: VisitTimeHint,
  now = new Date(),
): ResolvedVisitTime {
  const nowEc = nowInEcuador(now);
  const timeReference = toNull(hint.time_reference);
  const dayHint = toNull(hint.day_detected);
  const hourHint = toNull(hint.hour_detected);

  let dayDetected: string | null = null;
  const dayInfo = extractDayInfo(dayHint || timeReference || '');
  if (dayInfo) {
    dayDetected = resolveDay(dayInfo, nowEc, dayHint);
  } else if (dayHint) {
    dayDetected = dayHint;
  }

  const parsedHour = hourHint ? parseHourMinute(hourHint) : null;
  let hourDetected = parsedHour
    ? formatTimeHHMM(parsedHour.hour, parsedHour.minute)
    : hourHint;
  hourDetected = dropPeriodHour(hourDetected);

  const time = padTimeToHHMMSS(hourDetected);
  const visit_datetime =
    dayDetected && /^\d{4}-\d{2}-\d{2}$/.test(dayDetected) && time
      ? `${dayDetected}T${time}`
      : null;

  return {
    day_detected: dayDetected,
    hour_detected: hourDetected,
    visit_datetime,
  };
}
