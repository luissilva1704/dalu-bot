import capacityRepo from '../../repositories/capacityRepo.js';
import { getCurrentWeekMexico } from '../../utils/week.js';
import { getAllDays } from '../../utils/days.js';
import { normalizeDay } from '../../utils/dayMapping.js';
import { availabilityQuerySchema } from '../../validators/scheduleValidators.js';

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(data),
});

/**
 * Availability depends ONLY on dalu-capacity (aggregated).
 * Does NOT query dalu-schedules or dalu-bookings.
 */
export const handler = async (event) => {
  try {
    const query = event?.queryStringParameters ?? {};

    if (query.day !== undefined) {
      query.day = normalizeDay(query.day) ?? query.day;
    }

    const { year: qYear, weekNumber: qWeek, day: qDay, service } = availabilityQuerySchema.parse(query);

    const { year, weekNumber } = qYear && qWeek ? { year: qYear, weekNumber: qWeek } : getCurrentWeekMexico();

    if (qDay) {
      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, qDay);

      if (capacityItems.length === 0) {
        return json(404, {
          error: 'Not found',
          message: `No capacity found for ${qDay} (week ${weekNumber}, year ${year}). Configure schedules first.`,
        });
      }

      const slots = capacityItems.map((item) => ({
        slot: item.slot,
        capacityTotal: item.capacityTotal ?? 0,
        capacityAvailable: item.capacityAvailable ?? 0,
      }));
      const availableSlotsArr = slots.filter((s) => s.capacityAvailable > 0).map((s) => s.slot.toString() + ":" + "00");
      const availableSlots = availableSlotsArr.join(',');
      const bookedSlots = slots.filter((s) => s.capacityAvailable < s.capacityTotal).map((s) => s.slot.toString() + ":" + "00");

      return json(200, {
        day: qDay,
        service,
        weekNumber,
        year,
        slots,
        availableSlots,
        bookedSlots,
        message: 'Availability fetched successfully'
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
      const availableSlotsArr = slots.filter((s) => s.capacityAvailable > 0).map((s) => s.slot + ":" + "00");
      const availableSlots = availableSlotsArr.join(',');
      const bookedSlots = slots.filter((s) => s.capacityAvailable < s.capacityTotal).map((s) => s.slot);

      availability.push({ day, slots, availableSlots, bookedSlots });
    }

    if (availability.length === 0) {
      return json(404, {
        error: 'Not found',
        message: `No capacity found for week ${weekNumber}, year ${year}. Configure schedules first.`,
      });
    }

    return json(200,
      {
        availability,
        weekNumber,
        year,
        service
      });
  } catch (error) {
    console.error('availability handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
