import capacityRepo from '../../repositories/capacityRepo.js';
import bookingsRepo from '../../repositories/bookingsRepo.js';
import { sendBookingToGoogleSheets } from '../../services/googleSheetsWebhook.js';
import { getCurrentWeekMexico, getMonthAndDayFromWeek } from '../../utils/week.js';
import { normalizeDay } from '../../utils/dayMapping.js';
import { bookingSchema } from '../../validators/scheduleValidators.js';

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

/**
 * Pre-reserve flow:
 * 1) Decrement capacityAvailable atomically (fails 409 if no capacity)
 * 2) Create booking with status PENDING_ASSIGNMENT, technicianId null
 * Does NOT touch dalu-schedules.
 */
export const handler = async (event) => {
  try {
    const body = parseBody(event);

    if (body.slot !== undefined) body.slot = normalizeSlot(body.slot);
    if (body.day) body.day = normalizeDay(body.day) ?? body.day;

    const parsed = bookingSchema.parse(body);
    const { day, slot, service, customerName, customerInstagram } = parsed;
    const { year, weekNumber } =
      parsed.year && parsed.weekNumber
        ? { year: parsed.year, weekNumber: parsed.weekNumber }
        : getCurrentWeekMexico();

    const { month, dayOfMonth } = getMonthAndDayFromWeek(year, weekNumber, day);

    const slotCapacity = await capacityRepo.getSlotCapacity(year, weekNumber, day, slot);
    if (!slotCapacity) {
      return json(404, {
        error: 'Not found',
        message: `Slot ${slot} has no capacity for ${day} (week ${weekNumber}). Configure schedules first.`,
      });
    }

    if ((slotCapacity.capacityAvailable ?? 0) <= 0) {
      return json(409, {
        error: 'No capacity',
        message: `Slot ${slot} has no available capacity for ${day}.`,
      });
    }

    try {
      await capacityRepo.decrementAvailableAtomically(year, weekNumber, day, slot);
    } catch (err) {
      if (err.code === 'CONFLICT' || err.statusCode === 409) {
        return json(409, {
          error: 'No capacity',
          message: `Slot ${slot} is fully booked for ${day}.`,
        });
      }
      throw err;
    }

    const booking = await bookingsRepo.createPreReserveBooking({
      year,
      month,
      dayOfMonth,
      weekNumber,
      day,
      slotHour: slot,
      service,
      role: parsed.role,
      customerName: customerName ?? null,
      customerInstagram: customerInstagram ?? null,
    });

    await sendBookingToGoogleSheets(booking,year,weekNumber,day,slot,month,dayOfMonth);

    const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day);
    const slots = capacityItems.map((item) => ({
      slot: item.slot,
      capacityTotal: item.capacityTotal ?? 0,
      capacityAvailable: item.capacityAvailable ?? 0,
    }));
    const availableSlotsArr = slots.filter((s) => s.capacityAvailable > 0).map((s) => s.slot);
    const availableSlots = availableSlotsArr.join(',');
    const bookedSlots = slots.filter((s) => s.capacityAvailable < s.capacityTotal).map((s) => s.slot);

    return json(201, {
      message: 'Booking created successfully (pending technician assignment)',
      booking: {
        bookingId: booking.bookingId,
        day: booking.day,
        slot: booking.slotHour,
        service: booking.service,
        status: booking.status,
        technicianId: booking.technicianId ?? null,
        technicianName: booking.technicianName ?? null,
        customerName: booking.customerName,
        customerInstagram: booking.customerInstagram,
        createdAt: booking.createdAt,
      },
      availability: {
        day,
        availableSlots,
        bookedSlots,
      },
    });
  } catch (error) {
    console.error('bookings PUT handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
