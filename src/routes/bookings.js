import express from 'express';
import capacityRepo from '../repositories/capacityRepo.js';
import bookingsRepo from '../repositories/bookingsRepo.js';
import { getCurrentWeekMexico } from '../utils/week.js';
import { normalizeDay } from '../utils/dayMapping.js';
import { bookingSchema } from '../validators/scheduleValidators.js';
import bookingsAssignRouter from './bookingsAssign.js';

const router = express.Router();

// PUT /api/bookings/assign - must be before put('/') for correct matching
router.use('/assign', bookingsAssignRouter);

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

router.post('/', async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (body.slot !== undefined) body.slot = normalizeSlot(body.slot);
    if (body.day) body.day = normalizeDay(body.day) ?? body.day;

    const parsed = bookingSchema.parse(body);
    const { day, slot, service, customerName, customerInstagram } = parsed;
    const { year, weekNumber } =
      parsed.year && parsed.weekNumber
        ? { year: parsed.year, weekNumber: parsed.weekNumber }
        : getCurrentWeekMexico();

    const slotCapacity = await capacityRepo.getSlotCapacity(year, weekNumber, day, slot);
    if (!slotCapacity) {
      return res.status(404).json({
        error: 'Not found',
        message: `Slot ${slot} has no capacity for ${day} (week ${weekNumber}). Configure schedules first.`,
      });
    }

    if ((slotCapacity.capacityAvailable ?? 0) <= 0) {
      return res.status(409).json({
        error: 'No capacity',
        message: `Slot ${slot} has no available capacity for ${day}.`,
      });
    }

    try {
      await capacityRepo.decrementAvailableAtomically(year, weekNumber, day, slot);
    } catch (err) {
      if (err.code === 'CONFLICT' || err.statusCode === 409) {
        return res.status(409).json({
          error: 'No capacity',
          message: `Slot ${slot} is fully booked for ${day}.`,
        });
      }
      throw err;
    }

    const booking = await bookingsRepo.createPreReserveBooking({
      year,
      weekNumber,
      day,
      slotHour: slot,
      service,
      role: parsed.role,
      customerName: customerName ?? null,
      customerInstagram: customerInstagram ?? null,
    });

    const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day);
    const slots = capacityItems.map((item) => ({
      slot: item.slot,
      capacityTotal: item.capacityTotal ?? 0,
      capacityAvailable: item.capacityAvailable ?? 0,
    }));
    const availableSlotsArr = slots.filter((s) => s.capacityAvailable > 0).map((s) => s.slot);
    const availableSlots = availableSlotsArr.join(',');
    const bookedSlots = slots.filter((s) => s.capacityAvailable < s.capacityTotal).map((s) => s.slot);

    res.status(201).json({
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
      availability: { day, availableSlots, bookedSlots },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
