/**
 * ISO week number calculation for America/Mexico_City timezone
 * ISO 8601: week 1 is the week with the year's first Thursday
 * Implemented without external libs to keep bundle small for Lambda
 */

/**
 * Get current date/time as ISO string in America/Mexico_City timezone (GMT-6)
 */
export function getMexicoCityNowISO() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-06:00`;
}

/**
 * Get the current date in Mexico City timezone
 * Returns { year, month, day } as local date parts
 */
function getMexicoCityDate(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
  };
}

/**
 * Get ISO week number (1-53) for a given date
 * ISO 8601: Week starts on Monday. Week 1 contains Jan 4th.
 */
function getISOWeekNumber(year, month, day) {
  const date = new Date(year, month - 1, day);
  const dayNum = date.getDay() || 7; // Monday = 1, Sunday = 7
  date.setDate(date.getDate() + 4 - dayNum); // Thursday of that week
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const weekNum = 1 + Math.floor((date - jan1) / 86400000 / 7);
  return weekNum;
}

const DAY_NAME_TO_ISO = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ENGLISH_TO_SPANISH = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
};

/**
 * Formatea una lista de días con su número del mes en español.
 * Ej: formatWeekDays(2025, 12, ['tuesday', 'wednesday']) -> "Martes 17, Miércoles 18"
 */
export function formatWeekDays(year, weekNumber, dayNames) {
  return (dayNames ?? [])
    .map((day) => {
      const { dayOfMonth } = getMonthAndDayFromWeek(year, weekNumber, day);
      const name = ENGLISH_TO_SPANISH[String(day).toLowerCase()] ?? day;
      return `${name} ${dayOfMonth}`;
    })
}

/**
 * Get month name (Spanish) and day of month (1-31) from year, ISO week number, and day name
 */
export function getMonthAndDayFromWeek(year, weekNumber, dayName) {
  const dayOfWeek = DAY_NAME_TO_ISO[String(dayName).toLowerCase()] ?? 1;
  const jan4 = new Date(year, 0, 4);
  const dayOfJan4 = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(year, 0, 4 - dayOfJan4 + 1);
  const target = new Date(mondayOfWeek1);
  target.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7 + (dayOfWeek - 1));
  const monthIndex = target.getMonth();
  const dayOfMonth = target.getDate();
  return { month: MONTH_NAMES_ES[monthIndex], dayOfMonth };
}

/**
 * Get current ISO week and year for America/Mexico_City
 * @returns {{ year: number, weekNumber: number }}
 */
export function getCurrentWeekMexico() {
  const { year, month, day } = getMexicoCityDate();
  const weekNumber = getISOWeekNumber(year, month, day);
  return { year, weekNumber };
}

/**
 * Get the next ISO week and year for America/Mexico_City.
 * Used by schedules-reset when run on Saturday to prepare the following week.
 * @returns {{ year: number, weekNumber: number }}
 */
export function getNextWeekMexico() {
  return getWeekOffsetMexico(1);
}

/**
 * Get week (year, weekNumber) at offset from current. 0=actual, 1=siguiente, 2=siguiente+1.
 * Calendario puro: offset 1 = siguiente semana del calendario.
 * Para disponibilidad/bookings (considera reset sábado 15:00) usa getAvailabilityWeekOffsetMexico.
 * @param {number} offset - 0=current, 1=next, 2=next+1
 */
export function getWeekOffsetMexico(offset) {
  const { year, month, day } = getMexicoCityDate();
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset * 7);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return { year: y, weekNumber: getISOWeekNumber(y, m, d) };
}

/**
 * True si es sábado 15:00+ o domingo (el reset ya corrió).
 */
function isAfterSaturdayReset() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const hour = get('hour');
  const date = new Date(get('year'), get('month') - 1, get('day'));
  const dayOfWeek = date.getDay();
  return (dayOfWeek === 6 && hour >= 15) || dayOfWeek === 0;
}

/**
 * Offset de semana para disponibilidad, bookings y week-days.
 * Considera el reset del sábado 15:00: después del reset, "actual"=12, "siguiente"=13.
 * @param {number} offset - 0=actual (usa getBookingWeekMexico), 1=siguiente, 2=siguiente+1
 * @returns {{ year: number, weekNumber: number }}
 */
export function getAvailabilityWeekOffsetMexico(offset) {
  if (offset === 0) return getBookingWeekMexico();
  const effectiveOffset = offset + (isAfterSaturdayReset() ? 1 : 0);
  return getWeekOffsetMexico(effectiveOffset);
}

/**
 * Semana de reservas para disponibilidad/bookings (America/Mexico_City).
 * - Lunes–viernes: semana actual
 * - Sábado antes de las 15:00: semana actual (el cliente aún puede reservar ese sábado)
 * - Sábado 15:00 en adelante: siguiente semana (reset corrió, solo hay semanas 12/13 en BD)
 * - Domingo: siguiente semana
 * @returns {{ year: number, weekNumber: number }}
 */
export function getBookingWeekMexico() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

  if (dayOfWeek === 6 && hour < 15) {
    return getCurrentWeekMexico();
  }
  if (dayOfWeek === 0 || (dayOfWeek === 6 && hour >= 15)) {
    return getNextWeekMexico();
  }
  return getCurrentWeekMexico();
}

/**
 * Get date { year, month, day } for a given (year, weekNumber, dayName)
 */
export function getDateForWeekDay(year, weekNumber, dayName) {
  const dayOfWeek = DAY_NAME_TO_ISO[String(dayName).toLowerCase()] ?? 1;
  const jan4 = new Date(year, 0, 4);
  const dayOfJan4 = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(year, 0, 4 - dayOfJan4 + 1);
  const target = new Date(mondayOfWeek1);
  target.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7 + (dayOfWeek - 1));
  return {
    year: target.getFullYear(),
    month: target.getMonth() + 1,
    day: target.getDate(),
  };
}

/**
 * Returns true if (year, weekNumber, dayName) is before today (America/Mexico_City)
 */
export function isDayBeforeToday(year, weekNumber, dayName) {
  const today = getMexicoCityDate();
  const dayDate = getDateForWeekDay(year, weekNumber, dayName);
  if (dayDate.year < today.year) return true;
  if (dayDate.year > today.year) return false;
  if (dayDate.month < today.month) return true;
  if (dayDate.month > today.month) return false;
  return dayDate.day < today.day;
}

/**
 * Build DynamoDB partition key for schedules
 * Format: W#{year}#{weekNumber}#D#{day}
 */
export function schedulePk(year, weekNumber, day) {
  return `W#${year}#${weekNumber}#D#${day}`;
}

/**
 * Build DynamoDB sort key for schedules (technician)
 * Format: T#{technicianId}
 */
export function scheduleSk(technicianId) {
  return `T#${technicianId}`;
}

/**
 * Build DynamoDB partition key for bookings
 * Same as schedulePk
 */
export function bookingPk(year, weekNumber, day) {
  return `W#${year}#${weekNumber}#D#${day}`;
}

/**
 * Build DynamoDB sort key for bookings
 * Format: SLOT#{hour}#T#{technicianId} (assigned) or SLOT#{hour}#B#{bookingId} (pre-reserve)
 */
export function bookingSk(slotHour, technicianId) {
  return `SLOT#${slotHour}#T#${technicianId}`;
}

export function bookingPreReserveSk(slotHour, bookingId) {
  return `SLOT#${slotHour}#B#${bookingId}`;
}

// --- Capacity table (aggregated, no technician) ---
export function capacityPk(year, weekNumber, day) {
  return `Y#${year}#W#${weekNumber}#D#${day}`;
}

export function capacitySk(slot) {
  return `S#${slot}`;
}

// --- Bookings GSI byTechnician (for CONFIRMED bookings) ---
export function bookingTechnicianGsiPk(technicianId, year, weekNumber, day) {
  return `TECH#${technicianId}#Y#${year}#W#${weekNumber}#D#${day}`;
}

export function bookingTechnicianGsiSk(slotHour, bookingId) {
  return `S#${slotHour}#B#${bookingId}`;
}
