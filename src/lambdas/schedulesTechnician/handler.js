import schedulesRepo from '../../repositories/schedulesRepo.js';
import capacityRepo from '../../repositories/capacityRepo.js';
import bookingsRepo from '../../repositories/bookingsRepo.js';
import { getCurrentWeekMexico } from '../../utils/week.js';
import { normalizeDay } from '../../utils/dayMapping.js';
import {
  updateTechnicianScheduleSchema,
  technicianScheduleQuerySchema,
} from '../../validators/scheduleValidators.js';

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
 * GET /api/schedules/technician - Consult technician's own schedule
 * PUT /api/schedules/technician - Replace technician's slots for a day
 */
export const handler = async (event) => {
  const method = (event?.httpMethod ?? event?.requestContext?.http?.method ?? '').toUpperCase();

  if (method === 'GET') {
    return handleGet(event);
  }
  if (method === 'PUT') {
    return handlePut(event);
  }

  return json(405, { error: 'Method not allowed', message: `Unsupported method: ${method}` });
};

/**
 * GET - Technician consults their loaded availability
 */
async function handleGet(event) {
  try {
    const query = event?.queryStringParameters ?? {};
    if (query.day) query.day = normalizeDay(query.day) ?? query.day;

    const parsed = technicianScheduleQuerySchema.parse(query);
    const { technicianId, day } = parsed;
    const { year, weekNumber } =
      parsed.year != null && parsed.weekNumber != null
        ? { year: parsed.year, weekNumber: parsed.weekNumber }
        : getCurrentWeekMexico();

    if (day) {
      const schedule = await schedulesRepo.getScheduleForTechnicianDay(year, weekNumber, day, technicianId);
      if (!schedule) {
        return json(404, {
          error: 'Not found',
          message: `No schedule found for technician ${technicianId} on ${day} (week ${weekNumber}).`,
        });
      }
      return json(200, {
        year,
        weekNumber,
        technicianId,
        technicianName: schedule.technicianName,
        schedule: [
          { day: schedule.day, slots: schedule.slots ?? [], role: schedule.role, services: schedule.services ?? [] },
        ],
      });
    }

    const schedule = await schedulesRepo.getTechnicianScheduleForWeek(year, weekNumber, technicianId);
    if (schedule.length === 0) {
      return json(404, {
        error: 'Not found',
        message: `No schedule found for technician ${technicianId} (week ${weekNumber}, year ${year}).`,
      });
    }

    return json(200, {
      year,
      weekNumber,
      technicianId,
      technicianName: schedule[0]?.technicianName,
      schedule,
    });
  } catch (error) {
    console.error('schedulesTechnician GET handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
}

/**
 * PUT - Replace technician's slots for a specific day
 */
async function handlePut(event) {
  try {
    const body = parseBody(event);
    if (body.day) body.day = normalizeDay(body.day) ?? body.day;

    const parsed = updateTechnicianScheduleSchema.parse(body);
    const { technicianId, day, slots } = parsed;
    const { year, weekNumber } =
      parsed.year != null && parsed.weekNumber != null
        ? { year: parsed.year, weekNumber: parsed.weekNumber }
        : getCurrentWeekMexico();

    const oldSchedule = await schedulesRepo.getScheduleForTechnicianDay(year, weekNumber, day, technicianId);
    const oldSlots = oldSchedule?.slots ?? [];
    const newSlots = [...slots].sort((a, b) => a - b);

    const added = newSlots.filter((s) => !oldSlots.includes(s));
    const removed = oldSlots.filter((s) => !newSlots.includes(s));

    if (removed.length > 0) {
      const slotsOcupados = await bookingsRepo.getConfirmedSlotsByTechnicianDay(year, weekNumber, day, technicianId);
      const blocked = removed.filter((s) => slotsOcupados.has(s));
      if (blocked.length > 0) {
        return json(409, {
          error: 'Conflict',
          message: 'Cannot remove slots that have confirmed bookings.',
          blockedSlots: blocked,
        });
      }
    }

    await capacityRepo.batchAdjustFromDelta(year, weekNumber, day, added, removed);

    await schedulesRepo.upsertTechnicianDay({
      year,
      weekNumber,
      day,
      technicianId,
      technicianName: oldSchedule?.technicianName,
      role: oldSchedule?.role,
      services: oldSchedule?.services ?? [],
      slots: newSlots,
    });

    return json(200, {
      message: 'Schedule updated',
      day,
      technicianId,
      oldSlots,
      newSlots,
      added,
      removed,
    });
  } catch (error) {
    console.error('schedulesTechnician PUT handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
