import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { docClient, TABLES } from '../db/dynamo.js';
import { capacityPk, capacitySk } from '../utils/week.js';

/**
 * Capacity Repository - Aggregated capacity per week/day/slot
 *
 * Design: dalu-capacity
 * pk = "Y#{year}#W#{weekNumber}#D#{day}"
 * sk = "S#{slot}"
 * attributes: capacityTotal, capacityAvailable, updatedAt
 *
 * Updated automatically when technicians load schedules (POST schedules).
 * Decremented atomically when pre-reserve bookings are created.
 * availability depends ONLY on this table (not schedules).
 */
export class CapacityRepository {
  /**
   * Get capacity for all slots in a day
   */
  async getCapacityForDay(year, weekNumber, day) {
    const pk = capacityPk(year, weekNumber, day);

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.CAPACITY,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
      })
    );

    const items = (result.Items ?? []).map((item) => ({
      ...item,
      slot: item.slot ?? parseInt(item.sk?.replace('S#', '') ?? '0', 10),
    }));
    return items.sort((a, b) => a.slot - b.slot);
  }

  /**
   * Get capacity for a specific slot
   */
  async getSlotCapacity(year, weekNumber, day, slot) {
    const pk = capacityPk(year, weekNumber, day);
    const sk = capacitySk(slot);

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.CAPACITY,
        Key: { pk, sk },
      })
    );

    return result.Item ?? null;
  }

  /**
   * Decrement capacityAvailable atomically (for pre-reserve)
   * Fails with ConditionalCheckFailed if capacityAvailable <= 0
   */
  async decrementAvailableAtomically(year, weekNumber, day, slot) {
    const pk = capacityPk(year, weekNumber, day);
    const sk = capacitySk(slot);
    const now = new Date().toISOString();

    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.CAPACITY,
          Key: { pk, sk },
          UpdateExpression:
            'SET capacityAvailable = capacityAvailable - :one, updatedAt = :now',
          ConditionExpression: 'capacityAvailable > :zero',
          ExpressionAttributeValues: {
            ':one': 1,
            ':zero': 0,
            ':now': now,
          },
        })
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        const e = new Error('No capacity available for this slot');
        e.statusCode = 409;
        e.code = 'CONFLICT';
        throw e;
      }
      throw err;
    }
  }

  /**
   * Create or update slot capacity (for new slot with no existing item)
   */
  async upsertSlot(year, weekNumber, day, slot, { capacityTotal, capacityAvailable }) {
    const pk = capacityPk(year, weekNumber, day);
    const sk = capacitySk(slot);
    const now = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: TABLES.CAPACITY,
        Item: {
          pk,
          sk,
          year,
          weekNumber,
          day,
          slot,
          capacityTotal: capacityTotal ?? 0,
          capacityAvailable: capacityAvailable ?? 0,
          updatedAt: now,
        },
      })
    );
  }

  /**
   * Increment or decrement capacity for a slot (used when technician adds/removes slots)
   * deltaTotal: +1 or -1
   * deltaAvailable: +1 or -1 (for removed: ensure capacityAvailable doesn't go below 0)
   */
  async adjustSlotCapacity(year, weekNumber, day, slot, deltaTotal, deltaAvailable) {
    const pk = capacityPk(year, weekNumber, day);
    const sk = capacitySk(slot);
    const now = new Date().toISOString();

    // Try to update existing item
    const existing = await this.getSlotCapacity(year, weekNumber, day, slot);

    if (existing) {
      const newTotal = Math.max(0, (existing.capacityTotal ?? 0) + deltaTotal);
      const newAvailable = Math.max(
        0,
        Math.min(newTotal, (existing.capacityAvailable ?? 0) + deltaAvailable)
      );

      if (newTotal === 0) {
        await docClient.send(
          new DeleteCommand({ TableName: TABLES.CAPACITY, Key: { pk, sk } })
        );
        return;
      }

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.CAPACITY,
          Key: { pk, sk },
          UpdateExpression:
            'SET capacityTotal = :total, capacityAvailable = :available, updatedAt = :now',
          ExpressionAttributeValues: {
            ':total': newTotal,
            ':available': newAvailable,
            ':now': now,
          },
        })
      );
    } else if (deltaTotal > 0) {
      await this.upsertSlot(year, weekNumber, day, slot, {
        capacityTotal: deltaTotal,
        capacityAvailable: deltaAvailable > 0 ? deltaAvailable : 0,
      });
    }
    // if !existing and deltaTotal < 0: slot was never in capacity, skip (migration edge case)
  }

  /**
   * When technician is assigned: remove their slot from schedule.
   * Only decrement capacityTotal (capacityAvailable was already decremented at pre-reserve).
   */
  async decrementTotalForAssign(year, weekNumber, day, slot) {
    await this.adjustSlotCapacity(year, weekNumber, day, slot, -1, 0);
  }

  /**
   * Batch adjust capacity from delta (added/removed slots)
   * When technician updates schedule: added slots += 1, removed slots -= 1
   */
  async batchAdjustFromDelta(year, weekNumber, day, addedSlots, removedSlots) {
    for (const slot of addedSlots) {
      await this.adjustSlotCapacity(year, weekNumber, day, slot, 1, 1);
    }
    for (const slot of removedSlots) {
      await this.adjustSlotCapacity(year, weekNumber, day, slot, -1, -1);
    }
  }
}


export default new CapacityRepository();