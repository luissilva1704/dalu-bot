import express from 'express';
import bookingsRepo from '../repositories/bookingsRepo.js';
import schedulesRepo from '../repositories/schedulesRepo.js';
import capacityRepo from '../repositories/capacityRepo.js';
import { docClient, TABLES } from '../db/dynamo.js';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { assignBookingSchema } from '../validators/scheduleValidators.js';

const router = express.Router();

router.put('/', async (req, res, next) => {
  try {
    const { bookingId, technicianId, technicianName } = assignBookingSchema.parse(req.body);

    const booking = await bookingsRepo.getBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({
        error: 'Not found',
        message: `Booking ${bookingId} not found.`,
      });
    }

    if (booking.status !== 'PENDING_ASSIGNMENT') {
      return res.status(409).json({
        error: 'Conflict',
        message: `Booking cannot be assigned. Status: ${booking.status}.`,
      });
    }

    const { year, weekNumber, day, slotHour, service, role } = booking;
    const scheduleItems = await schedulesRepo.getSchedulesForDay(year, weekNumber, day, {
      service,
      role,
    });

    const techSchedule = scheduleItems.find((s) => s.technicianId === technicianId);
    if (!techSchedule) {
      return res.status(404).json({
        error: 'Not found',
        message: `Technician ${technicianId} has no schedule for ${day} (week ${weekNumber}).`,
      });
    }

    const hasSlot = (techSchedule.slots ?? []).includes(slotHour);
    if (!hasSlot) {
      return res.status(409).json({
        error: 'Technician not available',
        message: `Technician ${technicianId} does not have slot ${slotHour} for ${day}.`,
      });
    }

    const newSlots = (techSchedule.slots ?? [])
      .filter((s) => s !== slotHour)
      .sort((a, b) => a - b);

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLES.BOOKINGS,
              Key: { pk: booking.pk, sk: booking.sk },
              UpdateExpression:
                'SET technicianId = :tid, technicianName = :tname, #st = :status, updatedAt = :now',
              ConditionExpression: '#st = :pending',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':tid': technicianId,
                ':tname': technicianName ?? '',
                ':status': 'CONFIRMED',
                ':pending': 'PENDING_ASSIGNMENT',
                ':now': new Date().toISOString(),
              },
            },
          },
          {
            Update: {
              TableName: TABLES.SCHEDULES,
              Key: { pk: techSchedule.pk, sk: techSchedule.sk },
              UpdateExpression: 'SET slots = :newSlots, updatedAt = :now',
              ConditionExpression: 'contains(slots, :slot)',
              ExpressionAttributeValues: {
                ':newSlots': newSlots,
                ':slot': slotHour,
                ':now': new Date().toISOString(),
              },
            },
          },
        ],
      })
    );

    await capacityRepo.decrementTotalForAssign(year, weekNumber, day, slotHour);

    const updated = await bookingsRepo.getBookingById(bookingId);

    res.json({
      message: 'Technician assigned successfully',
      booking: {
        bookingId: updated.bookingId,
        day: updated.day,
        slot: updated.slotHour,
        service: updated.service,
        status: 'CONFIRMED',
        technicianId,
        technicianName: technicianName ?? '',
        customerName: updated.customerName,
        customerInstagram: updated.customerInstagram,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
