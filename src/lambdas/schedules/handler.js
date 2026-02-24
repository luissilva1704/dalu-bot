import schedulesRepo from '../../repositories/schedulesRepo.js';
import capacityRepo from '../../repositories/capacityRepo.js';
import { createScheduleSchema } from '../../validators/scheduleValidators.js';

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

    if (body.schedules && !body.technician) {
      return json(400, {
        error: 'Invalid payload',
        message:
          'Legacy format no longer supported. Use new format with year, weekNumber, technician, and availability.',
        example: {
          year: 2026,
          weekNumber: 5,
          technician: { id: 'tech_1', name: 'Tania', role: 'nails', services: ['acrilico', 'softgel'] },
          availability: [
            { day: 'monday', slots: [11, 12, 13] },
            { day: 'tuesday', slots: [11, 14, 15] },
          ],
        },
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

    return json(200, {
      message: 'Schedules updated successfully',
      year,
      weekNumber,
      technicianId: technician.id,
      schedules: results,
    });
  } catch (error) {
    console.error('schedules POST handler error:', error);

    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
