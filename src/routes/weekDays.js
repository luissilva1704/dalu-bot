/**
 * GET /api/week-days?week=actual|siguiente
 * Devuelve los días con disponibilidad en dalu-capacity formateados como
 * "Martes 17, Miércoles 18, Jueves 19, Viernes 20, Sábado 21"
 */

import express from 'express';
import capacityRepo from '../repositories/capacityRepo.js';
import { getWeekOffsetMexico, formatWeekDaysString } from '../utils/week.js';
import { FIXED_DAYS } from '../utils/fixedSchedule.js';

const router = express.Router();

const WEEK_VALUES = ['actual', 'current', 'siguiente', 'next'];

router.get('/', async (req, res, next) => {
  try {
    const weekParam = (req.query?.week ?? '').toLowerCase().trim();
    if (!WEEK_VALUES.includes(weekParam)) {
      return res.status(400).json({
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

    res.json({
      week: weekParam === 'siguiente' || weekParam === 'next' ? 'siguiente' : 'actual',
      year,
      weekNumber,
      days,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
