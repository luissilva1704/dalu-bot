/**
 * Bookings Repository - Fixed weekly capacity (NO technicians).
 *
 * pk = "Y#{year}#W#{weekNumber}#D#{day}"
 * sk = "B#{slotStart}##{bookingId}"
 *
 * Each booking blocks multiple consecutive slots based on service duration.
 * GSI: byBookingId (bookingId HASH) for lookup.
 */

import { PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../db/dynamo.js';
import { getMexicoCityNowISO } from '../utils/week.js';
import { randomUUID } from 'crypto';

// Capacity uses Y#year#W#week#D#day; keep booking pk format for consistency with capacity
function bookingPk(year, weekNumber, day) {
  return `Y#${year}#W#${weekNumber}#D#${day}`;
}

function bookingSk(slotStart, bookingId) {
  return `B#${slotStart}#${bookingId}`;
}

export class BookingsRepository {
  /**
   * Create booking with atomic capacity decrement (TransactWrite).
   * Decrements capacityAvailable by 1 for each slot in slotsBlocked.
   * Creates booking in same transaction.
   */
  async createBookingWithCapacityDecrement({
    year,
    weekNumber,
    day,
    slotStart,
    slotsBlocked,
    service,
    serviceGroup,
    nailsTechnique,
    durationHours,
    customerName,
    customerInstagram,
    phoneNumber,
    capacityTransactItems,
  }) {
    const bookingId = randomUUID();
    const pk = bookingPk(year, weekNumber, day);
    const sk = bookingSk(slotStart, bookingId);
    const now = getMexicoCityNowISO();

    const bookingItem = {
      pk,
      sk,
      bookingId,
      year,
      weekNumber,
      day,
      slotStart,
      slotsBlocked,
      service,
      serviceGroup: serviceGroup ?? undefined,
      nailsTechnique: nailsTechnique ?? undefined,
      durationHours,
      customerName: customerName ?? undefined,
      customerInstagram: customerInstagram ?? undefined,
      phoneNumber: phoneNumber ?? undefined,
      status: 'CONFIRMED',
      createdAt: now,
      updatedAt: now,
    };

    const transactItems = [
      ...capacityTransactItems,
      {
        Put: {
          TableName: TABLES.BOOKINGS,
          Item: bookingItem,
        },
      },
    ];

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    );

    return bookingItem;
  }

  /**
   * Get booking by bookingId (via GSI byBookingId)
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
   * @deprecated No technician assignments in fixed capacity model. Returns empty.
   */
  async getConfirmedSlotsByTechnicianDay(year, weekNumber, day, technicianId) {
    return new Set();
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
}

export default new BookingsRepository();
