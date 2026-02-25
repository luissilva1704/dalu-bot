import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../../db/dynamo.js';
import { bookingTechnicianGsiPk, bookingTechnicianGsiSk } from '../../utils/week.js';
import schedulesRepo from '../../repositories/schedulesRepo.js';
import bookingsRepo from '../../repositories/bookingsRepo.js';
import capacityRepo from '../../repositories/capacityRepo.js';
import { assignBookingSchema } from '../../validators/scheduleValidators.js';

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

/**
 * Assign technician to a PENDING_ASSIGNMENT booking.
 * 1) Validate booking exists and status = PENDING_ASSIGNMENT
 * 2) Validate technician has that slot in schedule and supports service/role
 * 3) TransactWrite: Update booking + Update schedule (remove slot from technician)
 *
 * Removing the slot from the technician's schedule "consumes" their availability
 * for that slot, preventing double-assignment.
 */
export const handler = async (event) => {
  try {
    const body = parseBody(event);
    const { bookingId, technicianId, technicianName } = assignBookingSchema.parse(body);

    const booking = await bookingsRepo.getBookingById(bookingId);
    if (!booking) {
      return json(404, {
        error: 'Not found',
        message: `Booking ${bookingId} not found.`,
      });
    }

    if (booking.status !== 'PENDING_ASSIGNMENT') {
      return json(409, {
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
      return json(404, {
        error: 'Not found',
        message: `Technician ${technicianId} has no schedule for ${day} (week ${weekNumber}).`,
      });
    }

    const hasSlot = (techSchedule.slots ?? []).includes(slotHour);
    if (!hasSlot) {
      return json(409, {
        error: 'Technician not available',
        message: `Technician ${technicianId} does not have slot ${slotHour} for ${day}.`,
      });
    }

    const newSlots = (techSchedule.slots ?? []).filter((s) => s !== slotHour).sort((a, b) => a - b);

    const gsi1pk = bookingTechnicianGsiPk(technicianId, year, weekNumber, day);
    const gsi1sk = bookingTechnicianGsiSk(slotHour, booking.bookingId);
    const now = new Date().toISOString();

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLES.BOOKINGS,
              Key: { pk: booking.pk, sk: booking.sk },
              UpdateExpression:
                'SET technicianId = :tid, technicianName = :tname, #st = :status, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk, updatedAt = :now',
              ConditionExpression: '#st = :pending',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':tid': technicianId,
                ':tname': technicianName ?? '',
                ':status': 'CONFIRMED',
                ':gsi1pk': gsi1pk,
                ':gsi1sk': gsi1sk,
                ':pending': 'PENDING_ASSIGNMENT',
                ':now': now,
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
                ':now': now,
              },
            },
          },
        ],
      })
    );

    await capacityRepo.decrementTotalForAssign(year, weekNumber, day, slotHour);

    const updated = await bookingsRepo.getBookingById(bookingId);

    return json(200, {
      message: 'Technician assigned successfully',
      booking: {
        bookingId: updated.bookingId,
        day: updated.day,
        slot: updated.slotHour,
        service: updated.service,
        status: 'CONFIRMED',
        technicianId: technicianId,
        technicianName: technicianName ?? '',
        customerName: updated.customerName,
        customerInstagram: updated.customerInstagram,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('bookings assign handler error:', error);

    if (error?.name === 'TransactionCanceledException') {
      const reason = error.CancellationReasons?.[0]?.Code ?? '';
      return json(409, {
        error: 'Conflict',
        message:
          reason === 'ConditionalCheckFailed'
            ? 'Booking was already assigned or technician slot no longer available.'
            : 'Transaction failed. Please try again.',
      });
    }

    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
