/**
 * Lambda: week-days
 * GET ?week=actual|siguiente
 * Devuelve los días con disponibilidad en dalu-capacity formateados como
 * "Martes 17, Miércoles 18, Jueves 19, Viernes 20, Sábado 21"
 */

import capacityRepo from '../../repositories/capacityRepo.js';
import { getWeekOffsetMexico, formatWeekDaysString } from '../../utils/week.js';
import { FIXED_DAYS } from '../../utils/fixedSchedule.js';

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(data),
});

const WEEK_VALUES = ['actual', 'current', 'siguiente', 'next'];

export const handler = async (event) => {
  try {
    const query = event?.queryStringParameters ?? {};
    const weekParam = (query.week ?? '').toLowerCase().trim();

    if (!WEEK_VALUES.includes(weekParam)) {
      return json(400, {
        error: 'Bad request',
        message: 'week debe ser "actual", "current", "siguiente" o "next"',
      });
    }

    const offset = weekParam === 'siguiente' || weekParam === 'next' ? 1 : 0;
    const { year, weekNumber } = getWeekOffsetMexico(offset);

    const daysWithCapacity = [];
    for (const day of FIXED_DAYS) {
      const items = await capacityRepo.getCapacityForDay(year, weekNumber, day);
      if (items.length > 0) {
        daysWithCapacity.push(day);
      }
    }

    const days = formatWeekDaysString(year, weekNumber, daysWithCapacity);

    return json(200, {
      message: days.length > 0 ? 'Week days fetched successfully' : 'No week days found',
      week: weekParam === 'siguiente' || weekParam === 'next' ? 'siguiente' : 'actual',
      year,
      weekNumber,
      days,
    });
  } catch (error) {
    console.error('week-days handler error:', error);
    return json(500, {
      error: 'Internal error',
      details: String(error?.message ?? error),
    });
  }
};
