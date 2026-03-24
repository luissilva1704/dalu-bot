/**
 * Service durations in hours - used for fixed weekly capacity model.
 * When a client books a service, multiple consecutive slots are blocked.
 *
 * Duración por servicio efectivo (acrilico, gel, pedicura, etc.)
 */

import { getEffectiveService } from './serviceGroups.js';

/** Duración (horas) por servicio efectivo */
export const SERVICE_DURATION_HOURS = {
  acrilico: 3,
  gel: 2,
  softgel: 2,
  pestañas: 3,
  pestanas: 3,
  cejas: 2,
  corte: 2,
  tintes: 2,
  tinte: 2,
  pedicura: 2,
  maquillaje: 2,
};

/** Alias para compatibilidad con availability (uñas + nailsTechnique) */
export const AVAILABILITY_SERVICES = [
  'uñas',
  'unas',
  'pedicura',
  'pestañas',
  'pestanas',
  'cejas',
  'corte',
  'tintes',
  'tinte',
  'maquillaje',
];

export const NAILS_TECHNIQUES = ['gel', 'softgel', 'acrilico'];

/**
 * @param {string} service - uñas, pedicura, pestañas, cejas, corte, tintes, maquillaje
 * @param {string} [nailsTechnique] - gel, softgel, acrilico (required when service=uñas)
 * @returns {number} Duration in hours (0 if unknown)
 */
export function getServiceDuration(service, nailsTechnique) {
  const effective = getEffectiveService(service, nailsTechnique);
  return SERVICE_DURATION_HOURS[effective] ?? 0;
}

/**
 * Build array of slot numbers that will be blocked for a booking.
 * @param {number} slotStart - Starting slot (e.g. 11)
 * @param {number} durationHours - Number of consecutive hours (e.g. 3)
 * @returns {number[]} e.g. [11, 12, 13]
 */
export function buildBlockedSlots(slotStart, durationHours) {
  const slots = [];
  for (let i = 0; i < durationHours; i++) {
    slots.push(slotStart + i);
  }
  return slots;
}

/**
 * Verifica si el slot en slotIndex puede iniciar un booking (N slots consecutivos con capacidad).
 * @param {object[]} capacityItems - Items ordenados por slot
 * @param {number} slotIndex - Índice del slot de inicio
 * @param {number} durationHours - Horas consecutivas requeridas
 * @returns {boolean}
 */
export function computeCanStartBooking(capacityItems, slotIndex, durationHours) {
  if (!durationHours || durationHours < 1) return true;
  const slot = capacityItems[slotIndex];
  if (!slot || (slot.capacityAvailable ?? 0) <= 0) return false;
  for (let i = 1; i < durationHours; i++) {
    const next = capacityItems[slotIndex + i];
    if (!next || (next.capacityAvailable ?? 0) <= 0) return false;
  }
  return true;
}

/**
 * Indica si un día tiene al menos un slot donde puede iniciar una reserva.
 * Considera la duración del servicio (slots consecutivos necesarios).
 * Usado por week-days para filtrar días con disponibilidad para un servicio.
 * @param {Array<{capacityAvailable?: number}>} capacityItems - Items ordenados por slot
 * @param {number} durationHours - Horas necesarias para el servicio
 * @returns {boolean}
 */
export function dayHasAvailableStartSlot(capacityItems, durationHours) {
  if (!capacityItems?.length) return false;
  if (!durationHours || durationHours < 1) {
    return capacityItems.some((s) => (s.capacityAvailable ?? 0) > 0);
  }
  for (let i = 0; i <= capacityItems.length - durationHours; i++) {
    if (computeCanStartBooking(capacityItems, i, durationHours)) return true;
  }
  return false;
}
