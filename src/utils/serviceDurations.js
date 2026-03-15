/**
 * Service durations in hours - used for fixed weekly capacity model.
 * When a client books a service, multiple consecutive slots are blocked.
 *
 * service: uñas, pedicura, pestañas, tinte, corte
 * When service=uñas, nailsTechnique required: gel (2h), softgel (2h), acrilico (3h)
 */

export const AVAILABILITY_SERVICES = ['uñas', 'unas', 'pedicura', 'pestañas', 'pestanas', 'tinte', 'corte'];
export const NAILS_TECHNIQUES = ['gel', 'softgel', 'acrilico'];

/** Duration (hours) when service=uñas, by nailsTechnique */
const NAILS_TECHNIQUE_DURATION = { gel: 2, softgel: 2, acrilico: 3 };

/** Duration (hours) for non-uñas services */
const SERVICE_DURATION_HOURS = {
  pedicura: 2,
  pestañas: 3,
  pestanas: 3,
  tinte: 3,
  corte: 2,
};

/**
 * @param {string} service - uñas, pedicura, pestañas, tinte, corte
 * @param {string} [nailsTechnique] - gel, softgel, acrilico (required when service=uñas)
 * @returns {number} Duration in hours
 */
export function getServiceDuration(service, nailsTechnique) {
  const s = String(service).toLowerCase().trim();
  if (s === 'uñas' || s === 'unas') {
    const t = String(nailsTechnique ?? '').toLowerCase().trim();
    return NAILS_TECHNIQUE_DURATION[t] ?? 0;
  }
  return SERVICE_DURATION_HOURS[s] ?? 0;
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
