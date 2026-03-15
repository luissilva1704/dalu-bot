/**
 * Bookings Lambda - Fixed weekly capacity (NO technicians).
 * Blocks multiple consecutive slots based on service duration.
 * Same flow as routes/bookings.js
 */

import capacityRepo from '../../repositories/capacityRepo.js';
import bookingsRepo from '../../repositories/bookingsRepo.js';
import { sendBookingToGoogleSheets } from '../../services/googleSheetsWebhook.js';
import { getBookingWeekMexico, getWeekOffsetMexico, getMonthAndDayFromWeek } from '../../utils/week.js';
import { getServiceDuration, buildBlockedSlots } from '../../utils/serviceDurations.js';
import { normalizeDay } from '../../utils/dayMapping.js';
import { bookingFixedSchema } from '../../validators/scheduleValidators.js';

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

function normalizeSlot(slot) {
  if (typeof slot === 'number') return slot;
  if (typeof slot === 'string') {
    const m = String(slot).match(/^(\d{1,2})/);
    if (m) return parseInt(m[1], 10);
    const n = parseInt(slot, 10);
    if (!isNaN(n)) return n;
  }
  return slot;
}

export const handler = async (event) => {
  try {
    const body = parseBody(event);
    if (body.slot !== undefined) body.slot = normalizeSlot(body.slot);
    if (body.day) body.day = normalizeDay(body.day) ?? body.day;

    const parsed = bookingFixedSchema.parse(body);
    const { day, slot, service, nailsTechnique, week: qWeek, customerName, customerInstagram, phoneNumber } = parsed;
    let year, weekNumber;
    if (qWeek && (qWeek === 'siguiente' || qWeek === 'next')) {
      ({ year, weekNumber } = getWeekOffsetMexico(1));
    } else if (qWeek && (qWeek === 'actual' || qWeek === 'current')) {
      ({ year, weekNumber } = getWeekOffsetMexico(0));
    } else {
      ({ year, weekNumber } = getBookingWeekMexico());
    }

    const durationHours = getServiceDuration(service, nailsTechnique);
    if (!durationHours) {
      return json(400, {
        error: 'Invalid service',
        message: `Unknown service or missing nailsTechnique. Valid: uñas (requires nailsTechnique: gel|softgel|acrilico), pedicura, pestañas, tinte, corte.`,
      });
    }

    const slotsBlocked = buildBlockedSlots(slot, durationHours);

    for (const s of slotsBlocked) {
      const cap = await capacityRepo.getSlotCapacity(year, weekNumber, day, s);
      if (!cap) {
        return json(404, {
          error: 'Not found',
          message: `Slot ${s} has no capacity for ${day}. Reset week first.`,
        });
      }
      if ((cap.capacityAvailable ?? 0) <= 0) {
        return json(409, {
          error: 'No capacity',
          message: `Not enough capacity for ${service} at ${slot}. Required slots ${slotsBlocked.join(',')} - slot ${s} has no availability.`,
        });
      }
    }

    const capacityTransactItems = capacityRepo.buildDecrementTransactItems(year, weekNumber, day, slotsBlocked);

    const booking = await bookingsRepo.createBookingWithCapacityDecrement({
      year,
      weekNumber,
      day,
      slotStart: slot,
      slotsBlocked,
      service,
      nailsTechnique: nailsTechnique ?? null,
      durationHours,
      customerName: customerName ?? null,
      customerInstagram: customerInstagram ?? null,
      phoneNumber: phoneNumber ?? null,
      capacityTransactItems,
    });

    const { month, dayOfMonth } = getMonthAndDayFromWeek(year, weekNumber, day);



    await sendBookingToGoogleSheets(booking, year, day, month, dayOfMonth);
    const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day);
    const slotsWithCanStart = capacityItems.map((item, idx) => {
      let canStart = (item.capacityAvailable ?? 0) > 0;
      if (durationHours > 0) {
        for (let i = 0; i < durationHours; i++) {
          const next = capacityItems[idx + i];
          if (!next || (next.capacityAvailable ?? 0) <= 0) {
            canStart = false;
            break;
          }
        }
      }
      return { ...item, canStartBooking: canStart };
    });
    const availableStartSlots = slotsWithCanStart.filter((s) => s.canStartBooking).map((s) => s.slot);

    return json(201, {
      message: 'Booking created successfully',
      booking: {
        bookingId: booking.bookingId,
        day: booking.day,
        slotStart: booking.slotStart,
        slotsBlocked: booking.slotsBlocked,
        service: booking.service,
        nailsTechnique: booking.nailsTechnique ?? null,
        durationHours: booking.durationHours,
        status: booking.status,
        customerName: booking.customerName,
        customerInstagram: booking.customerInstagram,
        phoneNumber: booking.phoneNumber ?? null,
        createdAt: booking.createdAt,
      },
      availability: { day, availableStartSlots },
    });
  } catch (error) {
    console.error('bookings PUT handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
