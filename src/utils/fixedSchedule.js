/**
 * Fixed weekly schedule - admin-managed capacity (no technicians).
 * Days: tuesday through saturday
 * Slots: 11 through 18 (11:00 - 18:00). Slots 19 y 20 excluidos.
 * La capacidad por slot es por serviceGroup (ver serviceGroups.GROUP_CAPACITY).
 */

export const FIXED_DAYS = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const FIXED_SLOTS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
