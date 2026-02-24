import express from 'express';
import schedulesRepo from '../repositories/schedulesRepo.js';
import capacityRepo from '../repositories/capacityRepo.js';
import { createScheduleSchema } from '../validators/scheduleValidators.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;

    if (body.schedules && !body.technician) {
      return res.status(400).json({
        error: 'Invalid payload',
        message:
          'Legacy format no longer supported. Use new format with year, weekNumber, technician, and availability.',
      });
    }

    const parsed = createScheduleSchema.parse(body);
    const { year, weekNumber, technician } = parsed;

    for (const { day, slots } of parsed.availability) {
      const oldSchedule = await schedulesRepo.getScheduleForTechnicianDay(year, weekNumber, day, technician.id);
      const oldSlots = oldSchedule?.slots ?? [];
      const newSlots = [...slots].sort((a, b) => a - b);

      const added = newSlots.filter((s) => !oldSlots.includes(s));
      const removed = oldSlots.filter((s) => !newSlots.includes(s));

      await capacityRepo.batchAdjustFromDelta(year, weekNumber, day, added, removed);
      await schedulesRepo.upsertTechnicianDay({
        year,
        weekNumber,
        day,
        technicianId: technician.id,
        technicianName: technician.name,
        role: technician.role,
        services: technician.services,
        slots: newSlots,
      });
    }

    const results = parsed.availability.map(({ day, slots }) => ({
      day,
      slots: [...slots].sort((a, b) => a - b),
      technicianId: technician.id,
    }));

    res.json({
      message: 'Schedules updated successfully',
      year,
      weekNumber,
      technicianId: technician.id,
      schedules: results,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
