/**
 * Capacity Repository - Capacidad por serviceGroup (nails, face_hair, pedicure, makeup).
 *
 * Design: dalu-capacity
 * pk = "Y#{year}#W#{weekNumber}#D#{day}"
 * sk = "G#{serviceGroup}#S#{slot}"  (ej: G#nails#S#11)
 *
 * Permite Query con begins_with(sk, "G#nails#") para obtener todos los slots de un grupo.
 * Cada grupo tiene capacidad independiente; un slot lleno en nails sigue disponible en pedicure.
 */

import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { docClient, TABLES } from '../db/dynamo.js';
import { capacityPk, capacitySk } from '../utils/week.js';
import { FIXED_DAYS, FIXED_SLOTS } from '../utils/fixedSchedule.js';
import { SERVICE_GROUPS, GROUP_CAPACITY } from '../utils/serviceGroups.js';

export class CapacityRepository {
  /**
   * Get capacity for all slots in a day for a specific serviceGroup.
   * @param {number} year
   * @param {number} weekNumber
   * @param {string} day - tuesday, wednesday, etc.
   * @param {string} serviceGroup - nails, face_hair, pedicure, makeup
   */
  async getCapacityForDay(year, weekNumber, day, serviceGroup) {
    const pk = capacityPk(year, weekNumber, day);
    const skPrefix = `G#${serviceGroup}#S#`;

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.CAPACITY,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': skPrefix },
      })
    );

    const items = (result.Items ?? []).map((item) => ({
      ...item,
      slot: item.slot ?? parseInt(String(item.sk).replace(/.*S#/, '') || '0', 10),
    })).filter((item) => item.slot !== 19 && item.slot !== 20);
    return items.sort((a, b) => a.slot - b.slot);
  }

  /**
    * Get capacity for a specific slot + serviceGroup.
   */
  async getSlotCapacity(year, weekNumber, day, slot, serviceGroup) {
    const pk = capacityPk(year, weekNumber, day);
    const sk = capacitySk(slot, serviceGroup);

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.CAPACITY,
        Key: { pk, sk },
      })
    );

    return result.Item ?? null;
  }

  /**
   * Build TransactWriteItems to atomically decrement capacityAvailable by 1
   * for each slot in the given serviceGroup.
   * @param {number} year
   * @param {number} weekNumber
   * @param {string} day
   * @param {number[]} slots - e.g. [11, 12, 13] for 3h service
   * @param {string} serviceGroup - nails, face_hair, pedicure, makeup
   */
  buildDecrementTransactItems(year, weekNumber, day, slots, serviceGroup) {
    const now = new Date().toISOString();
    return slots.map((slot) => {
      const pk = capacityPk(year, weekNumber, day);
      const sk = capacitySk(slot, serviceGroup);
      return {
        Update: {
          TableName: TABLES.CAPACITY,
          Key: { pk, sk },
          UpdateExpression: 'SET capacityAvailable = capacityAvailable - :one, updatedAt = :now',
          ConditionExpression: 'capacityAvailable > :zero',
          ExpressionAttributeValues: { ':one': 1, ':zero': 0, ':now': now },
        },
      };
    });
  }

  /**
   * Verifica si un día tiene capacidad (cualquier grupo).
   * Usado por week-days para listar días con disponibilidad.
   */
  async hasCapacityForDay(year, weekNumber, day) {
    const pk = capacityPk(year, weekNumber, day);
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.CAPACITY,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        Limit: 1,
        Select: 'COUNT',
      })
    );
    return (result.Count ?? 0) > 0;
  }

  /**
   * Borra todos los items de capacidad de una o más semanas.
   * Query por pk devuelve todos los items (todas las sk).
   */
  async deleteWeek(yearOrWeeks, weekNumber) {
    const weeks = Array.isArray(yearOrWeeks)
      ? yearOrWeeks
      : [{ year: yearOrWeeks, weekNumber }];

    for (const { year, weekNumber: wn } of weeks) {
      for (const day of FIXED_DAYS) {
        const pk = capacityPk(year, wn, day);
        const result = await docClient.send(
          new QueryCommand({
            TableName: TABLES.CAPACITY,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': pk },
          })
        );
        const items = result.Items ?? [];
        if (items.length > 0) {
          const deleteBatch = items.map((item) => ({
            DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
          }));
          for (let i = 0; i < deleteBatch.length; i += 25) {
            const batch = deleteBatch.slice(i, i + 25);
            await docClient.send(
              new BatchWriteCommand({
                RequestItems: { [TABLES.CAPACITY]: batch },
              })
            );
          }
        }
      }
    }
  }

  /**
   * Reset full week capacity: 4 registros por slot (uno por serviceGroup).
   * nails: 2, face_hair: 1, pedicure: 1, makeup: 1 por slot.
   */
  async resetWeek(year, weekNumber) {
    await this.deleteWeek(year, weekNumber);

    const now = new Date().toISOString();
    const putRequests = [];

    for (const day of FIXED_DAYS) {
      for (const slot of FIXED_SLOTS) {
        for (const serviceGroup of SERVICE_GROUPS) {
          const pk = capacityPk(year, weekNumber, day);
          const sk = capacitySk(slot, serviceGroup);
          const cap = GROUP_CAPACITY[serviceGroup] ?? 1;
          putRequests.push({
            PutRequest: {
              Item: {
                pk,
                sk,
                year,
                weekNumber,
                day,
                slot,
                serviceGroup,
                capacityTotal: cap,
                capacityAvailable: cap,
                updatedAt: now,
              },
            },
          });
        }
      }
    }

    for (let i = 0; i < putRequests.length; i += 25) {
      const batch = putRequests.slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: { [TABLES.CAPACITY]: batch },
        })
      );
    }

    return {
      daysProcessed: FIXED_DAYS.length,
      slotsPerDay: FIXED_SLOTS.length,
      groupsPerSlot: SERVICE_GROUPS.length,
      totalSlots: putRequests.length,
    };
  }
}

export default new CapacityRepository();
