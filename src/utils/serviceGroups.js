/**
 * Service Groups - Capacidad independiente por categoría de servicio.
 *
 * Cada serviceGroup tiene su propia capacidad por slot.
 * Un slot puede estar lleno para nails pero disponible para pedicure, makeup, etc.
 *
 * Grupos:
 * - nails: acrilico, gel, softgel (uñas)
 * - face_hair: cejas, pestañas, corte, tintes
 * - pedicure: pedicura
 * - makeup: maquillaje
 */

/** Mapeo servicio -> serviceGroup */
export const SERVICE_TO_GROUP = {
  acrilico: 'nails',
  gel: 'nails',
  softgel: 'nails',
  cejas: 'face_hair',
  pestañas: 'face_hair',
  pestanas: 'face_hair',
  corte: 'face_hair',
  tintes: 'face_hair',
  tinte: 'face_hair',
  pedicura: 'pedicure',
  maquillaje: 'makeup',
};

/** Grupos de servicio y sus capacidades por slot */
export const SERVICE_GROUPS = ['nails', 'face_hair', 'pedicure', 'makeup'];

/** Capacidad inicial por grupo al resetear */
export const GROUP_CAPACITY = {
  nails: 2,
  face_hair: 1,
  pedicure: 1,
  makeup: 1,
};

/**
 * Obtiene el serviceGroup a partir del servicio.
 * Si service=uñas/unas, usa nailsTechnique como servicio efectivo.
 * @param {string} service - uñas, pedicura, pestañas, cejas, corte, tintes, maquillaje
 * @param {string} [nailsTechnique] - gel, softgel, acrilico (requerido cuando service=uñas)
 * @returns {string|null} serviceGroup o null si no existe
 */
export function getServiceGroup(service, nailsTechnique) {
  const s = String(service ?? '').toLowerCase().trim();
  let effectiveService = s;

  if (s === 'uñas' || s === 'unas') {
    const t = String(nailsTechnique ?? '').toLowerCase().trim();
    if (!t) return null;
    effectiveService = t; // acrilico, gel, softgel
  }

  return SERVICE_TO_GROUP[effectiveService] ?? null;
}

/**
 * Servicio efectivo para duración/booking.
 * Normaliza uñas+nailsTechnique -> nailsTechnique.
 * @param {string} service
 * @param {string} [nailsTechnique]
 * @returns {string} servicio efectivo (acrilico, gel, pedicura, etc.)
 */
export function getEffectiveService(service, nailsTechnique) {
  const s = String(service ?? '').toLowerCase().trim();
  if (s === 'uñas' || s === 'unas') {
    return String(nailsTechnique ?? '').toLowerCase().trim() || s;
  }
  return s === 'pestanas' ? 'pestañas' : s;
}

/** Servicios permitidos (para validación) */
export const ALLOWED_SERVICES = [
  'uñas',
  'unas',
  'acrilico',
  'gel',
  'softgel',
  'pedicura',
  'pestañas',
  'pestanas',
  'cejas',
  'corte',
  'tintes',
  'tinte',
  'maquillaje',
];
