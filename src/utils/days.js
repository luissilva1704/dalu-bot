/**
 * Days of the week constants and utilities
 */
export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function isValidDay(day) {
  return DAYS_OF_WEEK.includes(day);
}

export function getAllDays() {
  return [...DAYS_OF_WEEK];
}
