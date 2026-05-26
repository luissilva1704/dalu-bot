/**
 * Bookings - Fixed weekly capacity (NO technicians).
 * Blocks visible consecutive slots based on service duration.
 */

import express from 'express';
import capacityRepo from '../repositories/capacityRepo.js';
import bookingsRepo from '../repositories/bookingsRepo.js';
import { sendBookingToGoogleSheets } from '../services/googleSheetsWebhook.js';
import { getBookingWeekMexico, getAvailabilityWeekOffsetMexico, getMonthAndDayFromWeek } from '../utils/week.js';
import { buildBlockedSlots, computeCanStartBooking, getServiceDuration } from '../utils/serviceDurations.js';
import { getServiceGroup } from '../utils/serviceGroups.js';
import { normalizeDay } from '../utils/dayMapping.js';
import { bookingFixedSchema } from '../validators/scheduleValidators.js';

const router = express.Router();

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

// PUT /api/bookings - Create booking (blocks visible slots by service duration)
router.put('/', async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (body.slot !== undefined) body.slot = normalizeSlot(body.slot);
    if (body.day) body.day = normalizeDay(body.day) ?? body.day;

    const parsed = bookingFixedSchema.parse(body);
    const { day, slot, service, nailsTechnique, week: qWeek, customerName, customerInstagram, phoneNumber } = parsed;
    let year, weekNumber;
    if (qWeek && (qWeek === 'siguiente' || qWeek === 'next')) {
      ({ year, weekNumber } = getAvailabilityWeekOffsetMexico(1));
    } else if (qWeek && (qWeek === 'actual' || qWeek === 'current')) {
      ({ year, weekNumber } = getAvailabilityWeekOffsetMexico(0));
    } else {
      ({ year, weekNumber } = getBookingWeekMexico());
    }

    const serviceGroup = getServiceGroup(service, nailsTechnique);
    if (!serviceGroup) {
      return res.status(400).json({
        error: 'Invalid service',
        message: 'service no válido o falta nailsTechnique cuando service=uñas',
      });
    }

    const durationHours = getServiceDuration(service, nailsTechnique);
    if (!durationHours) {
      return res.status(400).json({
        error: 'Invalid service',
        message: `Unknown service or missing nailsTechnique. Valid: uñas (requires nailsTechnique: gel|softgel|acrilico), pedicura, pestañas, tinte, corte.`,
      });
    }

    const slotsBlocked = buildBlockedSlots(slot, durationHours);

    for (const s of slotsBlocked) {
      const cap = await capacityRepo.getSlotCapacity(year, weekNumber, day, s, serviceGroup);
      if (!cap) {
        return res.status(404).json({
          error: 'Not found',
          message: `Slot ${s} has no capacity for ${day} (week ${weekNumber}). Reset week first.`,
        });
      }
      if ((cap.capacityAvailable ?? 0) <= 0) {
        return res.status(409).json({
          error: 'No capacity',
          message: `Not enough capacity for ${service} at ${slot}. Required slots ${slotsBlocked.join(',')} - slot ${s} has no availability.`,
        });
      }
    }

    const capacityTransactItems = capacityRepo.buildDecrementTransactItems(year, weekNumber, day, slotsBlocked, serviceGroup);

    const booking = await bookingsRepo.createBookingWithCapacityDecrement({
      year,
      weekNumber,
      day,
      slotStart: slot,
      slotsBlocked,
      service,
      nailsTechnique: nailsTechnique ?? null,
      serviceGroup,
      durationHours,
      customerName: customerName ?? null,
      customerInstagram: customerInstagram ?? null,
      phoneNumber: phoneNumber ?? null,
      capacityTransactItems,
    });

    const { month, dayOfMonth } = getMonthAndDayFromWeek(year, weekNumber, day);
    await sendBookingToGoogleSheets(booking, year, day, month, dayOfMonth);

    const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day, serviceGroup);
    const duration = getServiceDuration(service, nailsTechnique);
    const slotsWithCanStart = capacityItems.map((item, idx) => ({
      ...item,
      canStartBooking:
        duration > 0
          ? computeCanStartBooking(capacityItems, idx, duration)
          : (item.capacityAvailable ?? 0) > 0,
    }));
    const availableStartSlotsArr = slotsWithCanStart.filter((s) => s.canStartBooking).map((s) => s.slot);
    const availableStartSlots = availableStartSlotsArr.map((s) => `${s}:00`).join(', ');

    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        bookingId: booking.bookingId,
        day: booking.day,
        slotStart: booking.slotStart,
        slotsBlocked: booking.slotsBlocked,
        service: booking.service,
        nailsTechnique: booking.nailsTechnique ?? null,
        serviceGroup: booking.serviceGroup ?? null,
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
    next(error);
  }
});

// DEPRECATED: Assign route - technician model removed
router.put('/assign', (req, res) => {
  res.status(410).json({
    error: 'Gone',
    message: 'PUT /api/bookings/assign is deprecated. System uses fixed capacity (no technician assignment).',
  });
});

export default router;
