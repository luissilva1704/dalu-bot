import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../db/dynamo.js';
import { schedulePk, scheduleSk } from '../utils/week.js';

/**
 * Schedules Repository - Technician weekly availability
 *
 * DynamoDB model (Option A):
 * pk = "W#{year}#{weekNumber}#D#{day}"  → one partition per (week, day)
 * sk = "T#{technicianId}"               → one item per technician
 * attributes: slots[], services[], role, technicianName, updatedAt
 *
 * Why this design:
 * - Single Query gets all technicians for a day: efficient for availability aggregation
 * - Easy upsert: replace entire item for technician/day
 * - Low write cost: one Put per technician per day when updating
 * - Filter by service/role in app (small result set per day)
 */
export class SchedulesRepository {
  /**
   * Upsert technician availability for a specific week/day
   */
  async upsertTechnicianDay({ year, weekNumber, day, technicianId, technicianName, role, services, slots }) {
    const pk = schedulePk(year, weekNumber, day);
    const sk = scheduleSk(technicianId);
    const sortedSlots = [...(slots || [])].sort((a, b) => a - b);

    const item = {
      pk,
      sk,
      year,
      weekNumber,
      day,
      technicianId,
      technicianName: technicianName ?? undefined,
      role: role ?? undefined,
      services: services ?? [],
      slots: sortedSlots,
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.SCHEDULES,
        Item: item,
      })
    );

    return item;
  }

  /**
   * Upsert availability for multiple days (same technician, same week)
   */
  async upsertTechnicianWeek({ year, weekNumber, technician, availability }) {
    const { id, name, role, services } = technician;
    const results = [];

    for (const { day, slots } of availability) {
      const item = await this.upsertTechnicianDay({
        year,
        weekNumber,
        day,
        technicianId: id,
        technicianName: name,
        role,
        services,
        slots,
      });
      results.push({ day: item.day, slots: item.slots, technicianId: id });
    }

    return results;
  }

  /**
   * Get schedule for a single technician on a specific day (for delta calculation)
   */
  async getScheduleForTechnicianDay(year, weekNumber, day, technicianId) {
    const pk = schedulePk(year, weekNumber, day);
    const sk = scheduleSk(technicianId);

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.SCHEDULES,
        Key: { pk, sk },
      })
    );

    return result.Item ?? null;
  }

  /**
   * Get all technicians' schedules for a specific (year, week, day)
   * Returns items matching service (and optionally role)
   */
  async getSchedulesForDay(year, weekNumber, day, { service, role } = {}) {
    const pk = schedulePk(year, weekNumber, day);

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.SCHEDULES,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
      })
    );

    let items = result.Items ?? [];

    if (service) {
      items = items.filter((i) => i.services && i.services.includes(service));
    }
    if (role) {
      items = items.filter((i) => i.role === role);
    }

    return items;
  }

  /**
   * Get schedules for multiple days in a week
   */
  async getSchedulesForWeek(year, weekNumber, days, { service, role } = {}) {
    const byDay = {};
    for (const day of days) {
      const items = await this.getSchedulesForDay(year, weekNumber, day, { service, role });
      byDay[day] = items;
    }
    return byDay;
  }
}

export default new SchedulesRepository();
