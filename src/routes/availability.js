import express from 'express';
import capacityRepo from '../repositories/capacityRepo.js';
import { getCurrentWeekMexico } from '../utils/week.js';
import { getAllDays } from '../utils/days.js';
import { normalizeDay } from '../utils/dayMapping.js';
import { availabilityQuerySchema } from '../validators/scheduleValidators.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const query = { ...req.query };
    if (query.day) query.day = normalizeDay(query.day) ?? query.day;

    const { year: qYear, weekNumber: qWeek, day: qDay, service } = availabilityQuerySchema.parse(query);
    const { year, weekNumber } = qYear && qWeek ? { year: qYear, weekNumber: qWeek } : getCurrentWeekMexico();

    if (qDay) {
      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, qDay);

      if (capacityItems.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: `No capacity found for ${qDay} (week ${weekNumber}, year ${year}). Configure schedules first.`,
        });
      }

      const slots = capacityItems.map((item) => ({
        slot: item.slot,
        capacityTotal: item.capacityTotal ?? 0,
        capacityAvailable: item.capacityAvailable ?? 0,
      }));
      const availableSlotsArr = slots.filter((s) => s.capacityAvailable > 0).map((s) => s.slot);
      const availableSlots = availableSlotsArr.join(',');
      const bookedSlots = slots.filter((s) => s.capacityAvailable < s.capacityTotal).map((s) => s.slot);

      return res.json({
        day: qDay,
        service,
        weekNumber,
        year,
        slots,
        availableSlots,
        bookedSlots,
      });
    }

    const allDays = getAllDays();
    const availability = [];

    for (const day of allDays) {
      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day);
      if (capacityItems.length === 0) continue;

      const slots = capacityItems.map((item) => ({
        slot: item.slot,
        capacityTotal: item.capacityTotal ?? 0,
        capacityAvailable: item.capacityAvailable ?? 0,
      }));
      const availableSlotsArr = slots.filter((s) => s.capacityAvailable > 0).map((s) => s.slot);
      const availableSlots = availableSlotsArr.join(',');
      const bookedSlots = slots.filter((s) => s.capacityAvailable < s.capacityTotal).map((s) => s.slot);

      availability.push({ day, slots, availableSlots, bookedSlots });
    }

    if (availability.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: `No capacity found for week ${weekNumber}, year ${year}. Configure schedules first.`,
      });
    }

    res.json({ availability, weekNumber, year, service });
  } catch (error) {
    next(error);
  }
});

export default router;
