/**
 * Lambda: configured-availability
 * GET
 * Devuelve la disponibilidad de las semanas configuradas en dalu-capacity.
 * Agrupa la primera semana configurada como "semana actual" y la segunda como "Siguiente semana".
 */

import capacityRepo from '../../repositories/capacityRepo.js';
import { FIXED_DAYS } from '../../utils/fixedSchedule.js';
import { SERVICE_GROUPS } from '../../utils/serviceGroups.js';
import {
  formatWeekDays,
  getAvailabilityWeekOffsetMexico,
  isDayBeforeToday,
  isDayToday,
  isSlotBeforeNow,
  uniqISOWeeks,
} from '../../utils/week.js';

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(data),
});

const WEEK_LABELS = ['semana actual', 'Siguiente semana'];

function formatSlot(slot) {
  return `${slot}:00`;
}

function hasUpcomingDay({ year, weekNumber }) {
  return FIXED_DAYS.some((day) => !isDayBeforeToday(year, weekNumber, day));
}

async function getAvailableSlotsForDay(year, weekNumber, day) {
  const slots = new Set();

  await Promise.all(
    SERVICE_GROUPS.map(async (serviceGroup) => {
      const capacityItems = await capacityRepo.getCapacityForDay(year, weekNumber, day, serviceGroup);

      for (const item of capacityItems) {
        if (isSlotBeforeNow(year, weekNumber, day, item.slot)) continue;
        if ((item.capacityAvailable ?? 0) <= 0) continue;
        slots.add(item.slot);
      }
    })
  );

  return [...slots].sort((a, b) => a - b).map(formatSlot);
}

async function buildWeekAvailability(week) {
  const daysAvailability = {};

  for (const day of FIXED_DAYS) {
    if (isDayBeforeToday(week.year, week.weekNumber, day)) continue;

    const [dayLabel] = formatWeekDays(week.year, week.weekNumber, [day]);
    const availableSlots = await getAvailableSlotsForDay(week.year, week.weekNumber, day);
    if (isDayToday(week.year, week.weekNumber, day) && availableSlots.length === 0) continue;

    daysAvailability[dayLabel] = availableSlots.join(', ');
  }

  return daysAvailability;
}

function formatAvailabilityText(availability) {
  return Object.entries(availability)
    .map(([weekLabel, days]) => {
      const dayLines = Object.entries(days).map(([dayLabel, slots]) => {
        return `${dayLabel}: ${slots}`;
      });

      return [`${weekLabel}:`, ...dayLines].join('\n');
    })
    .join('\n\n');
}

export const handler = async () => {
  try {
    const candidateWeeks = uniqISOWeeks([
      getAvailabilityWeekOffsetMexico(0),
      getAvailabilityWeekOffsetMexico(1),
    ]);
    const weeksConfigured = (await capacityRepo.listConfiguredWeeks(candidateWeeks))
      .filter(hasUpcomingDay)
      .slice(0, 2);

    const availability = {};

    for (let i = 0; i < weeksConfigured.length; i++) {
      availability[WEEK_LABELS[i] ?? `Semana ${i + 1}`] = await buildWeekAvailability(weeksConfigured[i]);
    }

    return json(200, {
      message: weeksConfigured.length > 0 ? 'Configured availability fetched successfully' : 'No configured weeks found',
      weeksConfigured,
      availability,
      availabilityText: formatAvailabilityText(availability),
    });
  } catch (error) {
    console.error('configured-availability handler error:', error);
    return json(400, {
      error: 'Bad request',
      details: error?.errors ?? String(error?.message ?? error),
    });
  }
};
