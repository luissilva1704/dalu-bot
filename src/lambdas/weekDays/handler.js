/**
 * Lambda: week-days
 * GET ?week=actual|siguiente&service=pedicura&nailsTechnique=gel (si service=uñas)
 * Devuelve los días con disponibilidad para ese servicio en dalu-capacity.
 * Considera la duración del servicio (slots consecutivos necesarios).
 */

import capacityRepo from '../../repositories/capacityRepo.js';
import {
  getAvailabilityWeekOffsetMexico,
  formatWeekDays,
  isDayBeforeToday,
} from '../../utils/week.js';
import { FIXED_DAYS } from '../../utils/fixedSchedule.js';
import { getServiceGroup } from '../../utils/serviceGroups.js';
import { getServiceDuration, dayHasAvailableStartSlot } from '../../utils/serviceDurations.js';
import { normalizeDay } from '../../utils/dayMapping.js';
import { weekDaysQuerySchema } from '../../validators/scheduleValidators.js';

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(data),
});

export const handler = async (event) => {
  try {
    const query = event?.queryStringParameters ?? {};
    if (query.day) query.day = normalizeDay(query.day) ?? query.day;

    const parsed = weekDaysQuerySchema.parse(query);
    const { week: weekParam, service, nailsTechnique } = parsed;

    // Misma lógica que availability/bookings: usa getAvailabilityWeekOffsetMexico (considera isAfterSaturdayReset)
    const offset = weekParam === 'siguiente' || weekParam === 'next' ? 1 : 0;
    const { year, weekNumber } = getAvailabilityWeekOffsetMexico(offset);

    const serviceGroup = getServiceGroup(service, nailsTechnique);
    if (!serviceGroup) {
      return json(400, {
        error: 'Invalid service',
        message: 'service no válido o falta nailsTechnique cuando service=uñas',
      });
    }

    const durationHours = getServiceDuration(service, nailsTechnique);
    if (!durationHours) {
      return json(400, {
        error: 'Invalid service',
        message: 'Duración desconocida para el servicio indicado.',
      });
    }

    const daysWithCapacity = [];
    for (const day of FIXED_DAYS) {
      if (isDayBeforeToday(year, weekNumber, day)) continue;

      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day, serviceGroup);
      if (dayHasAvailableStartSlot(capacityItems, durationHours)) {
        daysWithCapacity.push(day);
      }
    }

    const days = formatWeekDays(year, weekNumber, daysWithCapacity);
    const daysString = days.join(', ');

    return json(200, {
      message: days.length > 0 ? 'Week days fetched successfully' : 'No week days found',
      week: weekParam === 'siguiente' || weekParam === 'next' ? 'siguiente' : 'actual',
      year,
      weekNumber,
      service: service ?? null,
      nailsTechnique: nailsTechnique ?? null,
      serviceGroup,
      days: daysString,
      objectDays: days.reduce((acc, day) => {
        acc[day.split(' ')[0]] = day;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('week-days handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
