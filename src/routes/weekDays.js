/**
 * GET /api/week-days?week=actual|siguiente&service=pedicura
 * Devuelve los días con disponibilidad para ese servicio.
 * Requiere service (y nailsTechnique cuando service=uñas).
 */

import express from 'express';
import capacityRepo from '../repositories/capacityRepo.js';
import {
  getAvailabilityWeekOffsetMexico,
  formatWeekDays,
  isDayBeforeToday,
} from '../utils/week.js';
import { FIXED_DAYS } from '../utils/fixedSchedule.js';
import { getServiceGroup } from '../utils/serviceGroups.js';
import { getServiceDuration, dayHasAvailableStartSlot } from '../utils/serviceDurations.js';
import { normalizeDay } from '../utils/dayMapping.js';
import { weekDaysQuerySchema } from '../validators/scheduleValidators.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const query = { ...req.query };
    if (query.day) query.day = normalizeDay(query.day) ?? query.day;

    const parsed = weekDaysQuerySchema.parse(query);
    const { week: weekParam, service, nailsTechnique } = parsed;

    // Misma lógica que availability/bookings: usa getAvailabilityWeekOffsetMexico (considera isAfterSaturdayReset)
    const offset = weekParam === 'siguiente' || weekParam === 'next' ? 1 : 0;
    const { year, weekNumber } = getAvailabilityWeekOffsetMexico(offset);

    const serviceGroup = getServiceGroup(service, nailsTechnique);
    if (!serviceGroup) {
      return res.status(400).json({
        error: 'Invalid service',
        message: 'service no válido o falta nailsTechnique cuando service=uñas',
      });
    }

    const durationHours = getServiceDuration(service, nailsTechnique);
    if (!durationHours) {
      return res.status(400).json({
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

    res.json({
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
    next(error);
  }
});

export default router;
