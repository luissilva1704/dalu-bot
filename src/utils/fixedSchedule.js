/**
 * Fixed weekly schedule - admin-managed capacity (no technicians).
 * Days: tuesday through saturday
 * Slots: 11 through 20 (11:00 - 20:00) - permite reservar hasta las 18 como hora de inicio
 * incluso para servicios de 3h (18, 19, 20).
 * Capacity per slot: 2
 */

export const FIXED_DAYS = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const FIXED_SLOTS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
export const CAPACITY_PER_SLOT = 2;
