/**
 * POST /api/schedules/reset-week
 * Admin endpoint: reset fixed weekly capacity (tuesday-saturday, slots 11-20, capacity 2 each).
 * Idempotent - replaces existing capacity for the week.
 */

import capacityRepo from '../../repositories/capacityRepo.js';
import { getCurrentWeekMexico, getWeekOffsetMexico } from '../../utils/week.js';
import { resetWeekSchema } from '../../validators/scheduleValidators.js';

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(data),
});

function parseBody(event) {
  if (!event?.body) return {};
  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch {
      return {};
    }
  }
  return event.body;
}

export const handler = async (event) => {
  try {
    const body = parseBody(event);
    resetWeekSchema.parse(body ?? {});
    const current = getCurrentWeekMexico();
    const week1 = getWeekOffsetMexico(1); // siguiente
    const week2 = getWeekOffsetMexico(2); // siguiente+1

    await capacityRepo.deleteWeek([current, week1, week2]);
    // Ejecutar ambas semanas en paralelo para reducir tiempo y evitar timeout
    const [result1, result2] = await Promise.all([
      capacityRepo.resetWeek(week1.year, week1.weekNumber),
      capacityRepo.resetWeek(week2.year, week2.weekNumber),
    ]);

    return json(200, {
      message: 'Week reset successfully (2 weeks)',
      weeksCreated: [
        { year: week1.year, weekNumber: week1.weekNumber, ...result1 },
        { year: week2.year, weekNumber: week2.weekNumber, ...result2 },
      ],
    });
  } catch (error) {
    console.error('schedules reset-week handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
