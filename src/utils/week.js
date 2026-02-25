/**
 * ISO week number calculation for America/Mexico_City timezone
 * ISO 8601: week 1 is the week with the year's first Thursday
 * Implemented without external libs to keep bundle small for Lambda
 */

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
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

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
