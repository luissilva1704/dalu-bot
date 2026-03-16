/**
 * Availability - Fixed weekly capacity (NO technicians).
 * Reads ONLY from dalu-capacity.
 * service: uñas, pedicura, pestañas, tinte, corte
 * Cuando service=uñas, nailsTechnique (gel|softgel|acrilico) es requerido.
 */

import capacityRepo from '../../repositories/capacityRepo.js';
import { getBookingWeekMexico, getAvailabilityWeekOffsetMexico, isDayBeforeToday } from '../../utils/week.js';
import { FIXED_DAYS } from '../../utils/fixedSchedule.js';
import { getServiceDuration } from '../../utils/serviceDurations.js';
import { getServiceGroup } from '../../utils/serviceGroups.js';
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
      ({ year, weekNumber } = getAvailabilityWeekOffsetMexico(1));
    } else if (qWeekParam && (qWeekParam === 'actual' || qWeekParam === 'current')) {
      // Sábado/domingo → siguiente semana (tras reset a las 15:00, semana actual ya no tiene datos).
      // Lunes–viernes → semana actual.
      ({ year, weekNumber } = getBookingWeekMexico());
    } else {
      ({ year, weekNumber } = getBookingWeekMexico());
    }

    const serviceGroup = getServiceGroup(service, nailsTechnique);
    if (!serviceGroup) {
      return json(400, {
        error: 'Invalid service',
        message: 'service no válido o falta nailsTechnique cuando service=uñas',
      });
    }

    const durationHours = getServiceDuration(service, nailsTechnique);

    if (qDay) {
      if (isDayBeforeToday(year, weekNumber, qDay)) {
        return json(200, {
          message: 'Availability fetched successfully',
          day: qDay,
          service: service ?? null,
          nailsTechnique: nailsTechnique ?? null,
          serviceGroup,
          year,
          weekNumber,
          slots: [],
          availableStartSlots: '',
        });
      }

      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, qDay, serviceGroup);

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
          ? slots.filter((s) => s.canStartBooking && s.slot !== 19 && s.slot !== 20).map((s) => s.slot)
          : slots.filter((s) => (s.capacityAvailable ?? 0) > 0 && s.slot !== 19 && s.slot !== 20).map((s) => s.slot);
      const availableStartSlots = availableStartSlotsArr.map((s) => `${s}:00`).join(', ');

      return json(200, {
        message: 'Availability fetched successfully',
        day: qDay,
        service: service ?? null,
        nailsTechnique: nailsTechnique ?? null,
        serviceGroup,
        year,
        weekNumber,
        slots,
        availableStartSlots,
      });
    }

    const availability = [];
    for (const day of FIXED_DAYS) {
      if (isDayBeforeToday(year, weekNumber, day)) continue;

      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day, serviceGroup);
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
          ? slots.filter((s) => s.canStartBooking && s.slot !== 19 && s.slot !== 20).map((s) => s.slot)
          : slots.filter((s) => (s.capacityAvailable ?? 0) > 0 && s.slot !== 19 && s.slot !== 20).map((s) => s.slot);
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
      serviceGroup,
    });
  } catch (error) {
    console.error('availability handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
