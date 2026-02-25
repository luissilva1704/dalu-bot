import { PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../db/dynamo.js';
import { bookingPk, bookingPreReserveSk } from '../utils/week.js';
import { randomUUID } from 'crypto';

/**
 * Bookings Repository - Pre-reserve (no technician) + Assign flow
 *
 * pk = "W#{year}#{weekNumber}#D#{day}"
 * sk = "SLOT#{hour}#B#{bookingId}"  (pre-reserve) or "SLOT#{hour}#T#{technicianId}" (legacy assigned)
 *
 * GSI: bookingId (HASH) for lookup by id
 *
 * Pre-reserve: technicianId null, status PENDING_ASSIGNMENT
 * Assigned: technicianId set, status CONFIRMED
 */
export class BookingsRepository {
  /**
   * Create pre-reserve booking (no technician, status PENDING_ASSIGNMENT)
   * Must be called AFTER capacityRepo.decrementAvailableAtomically
   */
  async createPreReserveBooking({
    year,
    weekNumber,
    day,
    slotHour,
    service,
    role,
    customerName,
    customerInstagram,
    phoneNumber,
  }) {
    const bookingId = randomUUID();
    const pk = bookingPk(year, weekNumber, day);
    const sk = bookingPreReserveSk(slotHour, bookingId);
    const now = new Date().toISOString();

    const item = {
      pk,
      sk,
      bookingId,
      year,
      weekNumber,
      day,
      slotHour,
      service,
      role: role ?? undefined,
      technicianId: undefined,
      technicianName: undefined,
      status: 'PENDING_ASSIGNMENT',
      customerName: customerName ?? undefined,
      customerInstagram: customerInstagram ?? undefined,
      phoneNumber: phoneNumber ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.BOOKINGS,
        Item: item,
      })
    );

    return item;
  }

  /**
   * Get booking by bookingId (via GSI)
   */
  async getBookingById(bookingId) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.BOOKINGS,
        IndexName: 'byBookingId',
        KeyConditionExpression: 'bookingId = :id',
        ExpressionAttributeValues: { ':id': bookingId },
      })
    );

    const items = result.Items ?? [];
    return items[0] ?? null;
  }

  /**
   * Get slots occupied by CONFIRMED bookings for a technician on a specific day.
   * Uses getBookingsForDay + filter (works without byTechnician GSI).
   * When byTechnician GSI exists, could be optimized to query it directly.
   */
  async getConfirmedSlotsByTechnicianDay(year, weekNumber, day, technicianId) {
    const bookings = await this.getBookingsForDay(year, weekNumber, day);
    const slots = bookings
      .filter((b) => b.technicianId === technicianId && b.status === 'CONFIRMED')
      .map((b) => b.slotHour)
      .filter((s) => s != null);
    return new Set(slots);
  }

  /**
   * Get all bookings for a (year, week, day)
   */
  async getBookingsForDay(year, weekNumber, day) {
    const pk = bookingPk(year, weekNumber, day);

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.BOOKINGS,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
      })
    );

    return result.Items ?? [];
  }

  /**
   * Update booking: assign technician, set status CONFIRMED
   * Condition: status must be PENDING_ASSIGNMENT
   */
  async updateBookingAssign(bookingId, technicianId, technicianName) {
    const booking = await this.getBookingById(bookingId);
    if (!booking) return null;

    const now = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
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
          ':now': now,
        },
      })
    );

    return { ...booking, technicianId, technicianName, status: 'CONFIRMED', updatedAt: now };
  }

  getSlotHour(booking) {
    return booking.slotHour;
  }
}

export default new BookingsRepository();
