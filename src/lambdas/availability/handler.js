/**
 * Availability - Fixed weekly capacity (NO technicians).
 * Reads ONLY from dalu-capacity.
 * service: uñas, pedicura, pestañas, tinte, corte
 * Cuando service=uñas, nailsTechnique (gel|softgel|acrilico) es requerido.
 */

import capacityRepo from '../../repositories/capacityRepo.js';
import { getBookingWeekMexico, getWeekOffsetMexico, isDayBeforeToday } from '../../utils/week.js';
import { FIXED_DAYS } from '../../utils/fixedSchedule.js';
import { getServiceDuration } from '../../utils/serviceDurations.js';
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

function computeCanStartBooking(capacityItems, slotIndex, durationHours) {
  if (!durationHours || durationHours < 1) return true;
  const slot = capacityItems[slotIndex];
  if (!slot || (slot.capacityAvailable ?? 0) <= 0) return false;
  for (let i = 1; i < durationHours; i++) {
    const next = capacityItems[slotIndex + i];
    if (!next || (next.capacityAvailable ?? 0) <= 0) return false;
  }
  return true;
}

export const handler = async (event) => {
  try {
    const query = event?.queryStringParameters ?? {};
    if (query.day) query.day = normalizeDay(query.day) ?? query.day;

    const parsed = availabilityQuerySchema.parse(query);
    const { year: qYear, weekNumber: qWeek, day: qDay, service, nailsTechnique, week: qWeekParam } = parsed;
    let year, weekNumber;
    if (qYear != null && qWeek != null) {
      year = qYear;
      weekNumber = qWeek;
    } else if (qWeekParam && (qWeekParam === 'siguiente' || qWeekParam === 'next')) {
      ({ year, weekNumber } = getWeekOffsetMexico(1));
    } else if (qWeekParam && (qWeekParam === 'actual' || qWeekParam === 'current')) {
      ({ year, weekNumber } = getWeekOffsetMexico(0));
    } else {
      ({ year, weekNumber } = getBookingWeekMexico());
    }

    const durationHours = service ? getServiceDuration(service, nailsTechnique) : 0;

    if (qDay) {
      if (isDayBeforeToday(year, weekNumber, qDay)) {
        return json(200, {
          message: 'Availability fetched successfully',
          day: qDay,
          service: service ?? null,
          nailsTechnique: nailsTechnique ?? null,
          year,
          weekNumber,
          slots: [],
          availableStartSlots: '',
        });
      }

      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, qDay);

      if (capacityItems.length === 0) {
        return json(404, {
          error: 'Not found',
          message: `No capacity found for ${qDay} (week ${weekNumber}, year ${year}). Reset week first.`,
        });
      }

      const slots = capacityItems.map((item, idx) => ({
        slot: item.slot,
        capacityTotal: item.capacityTotal ?? 0,
        capacityAvailable: item.capacityAvailable ?? 0,
        canStartBooking:
          durationHours > 0
            ? computeCanStartBooking(capacityItems, idx, durationHours)
            : (item.capacityAvailable ?? 0) > 0,
      }));

      const availableStartSlotsArr =
        durationHours > 0
          ? slots.filter((s) => s.canStartBooking).map((s) => s.slot)
          : slots.filter((s) => (s.capacityAvailable ?? 0) > 0).map((s) => s.slot);
      const availableStartSlots = availableStartSlotsArr.map((s) => `${s}:00`).join(', ');

      return json(200, {
        message: 'Availability fetched successfully',
        day: qDay,
        service: service ?? null,
        nailsTechnique: nailsTechnique ?? null,
        year,
        weekNumber,
        slots,
        availableStartSlots,
      });
    }

    const availability = [];
    for (const day of FIXED_DAYS) {
      if (isDayBeforeToday(year, weekNumber, day)) continue;

      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day);
      if (capacityItems.length === 0) continue;

      const slots = capacityItems.map((item, idx) => ({
        slot: item.slot,
        capacityTotal: item.capacityTotal ?? 0,
        capacityAvailable: item.capacityAvailable ?? 0,
        canStartBooking:
          durationHours > 0
            ? computeCanStartBooking(capacityItems, idx, durationHours)
            : (item.capacityAvailable ?? 0) > 0,
      }));

      const availableStartSlotsArr =
        durationHours > 0
          ? slots.filter((s) => s.canStartBooking).map((s) => s.slot)
          : slots.filter((s) => (s.capacityAvailable ?? 0) > 0).map((s) => s.slot);
      const availableStartSlots = availableStartSlotsArr.map((s) => `${s}:00`).join(', ');

      availability.push({ day, slots, availableStartSlots });
    }

    if (availability.length === 0) {
      return json(404, {
        error: 'Not found',
        message: `No capacity found for week ${weekNumber}, year ${year}. Reset week first.`,
      });
    }

    return json(200, {
      message: 'Availability fetched successfully',
      availability,
      weekNumber,
      year,
      service: service ?? null,
      nailsTechnique: nailsTechnique ?? null,
    });
  } catch (error) {
    console.error('availability handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
