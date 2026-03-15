/**
 * Mapeo de días español <-> inglés
 * Usado para normalizar input de usuarios (español) a formato interno (inglés)
 */
export const SPANISH_TO_ENGLISH = {
  lunes: 'monday',
  martes: 'tuesday',
  miércoles: 'wednesday',
  miercoles: 'wednesday',
  jueves: 'thursday',
  viernes: 'friday',
  sábado: 'saturday',
  sabado: 'saturday',
};

export const ENGLISH_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const ENGLISH_TO_SPANISH = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
};

export function toSpanishDay(day) {
  if (!day) return day;
  const d = String(day).toLowerCase().trim();
  return ENGLISH_TO_SPANISH[d] ?? day;
}

export function normalizeDay(day) {
  if (!day) return day;
  const d = String(day).toLowerCase().trim();
  return SPANISH_TO_ENGLISH[d] ?? (ENGLISH_DAYS.includes(d) ? d : day);
}
