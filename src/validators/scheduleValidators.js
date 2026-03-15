import { z } from 'zod';

const MIN_HOUR = 11;
const MAX_HOUR = 20;

const SPANISH_DAYS = {
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
export const ROLES = ['nails', 'lashes', 'brows'];
export const SERVICES = ['acrilico', 'softgel', 'rubber', 'gel'];
export const NAILS_TECHNIQUES = ['acrilico', 'softgel', 'gel'];

const daySchema = z
  .string()
  .transform((v) => {
    const d = (v ?? '').toLowerCase().trim();
    return SPANISH_DAYS[d] ?? (ENGLISH_DAYS.includes(d) ? d : v);
  })
  .pipe(z.enum(ENGLISH_DAYS, { errorMap: () => ({ message: 'Day must be a valid weekday' }) }));

// --- NEW: Technician weekly schedule ---
export const technicianSchema = z.object({
  id: z.string().min(1, 'technician id is required'),
  name: z.string().optional(),
  role: z.enum(ROLES).optional(),
  services: z.array(z.enum(SERVICES)).min(1, 'at least one service required'),
});

export const availabilityDaySchema = z.object({
  day: daySchema,
  slots: z.array(z.number().int().min(MIN_HOUR).max(MAX_HOUR)).refine(
    (arr) => new Set(arr).size === arr.length,
    { message: 'Slots must be unique' }
  ),
});

export const createScheduleSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  weekNumber: z.number().int().min(1).max(53),
  technician: technicianSchema,
  availability: z.array(availabilityDaySchema).min(1, 'at least one day required'),
});

// --- Reset week (fixed capacity, no technicians) - sin parámetros, usa semana actual ---
export const resetWeekSchema = z.object({});

// --- Availability query: service = uñas|pedicura|pestañas|tinte|corte ---
// Cuando service=uñas, nailsTechnique (gel|softgel|acrilico) es requerido
const AVAILABILITY_SERVICES = ['uñas', 'unas', 'pedicura', 'pestañas', 'pestanas', 'tinte', 'corte'];

const NAILS_TECHNIQUES_AVAIL = ['gel', 'softgel', 'acrilico'];
const fixedDaySchema = z.enum(['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], {
  errorMap: () => ({ message: 'Day must be tuesday through saturday' }),
});

const WEEK_VALUES_AVAIL = ['actual', 'current', 'siguiente', 'next'];

export const availabilityQuerySchema = z
  .object({
    day: z
      .string()
      .transform((v) => {
        const d = (v ?? '').toLowerCase().trim();
        return SPANISH_DAYS[d] ?? (['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(d) ? d : v);
      })
      .pipe(fixedDaySchema)
      .optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    weekNumber: z.coerce.number().int().min(1).max(53).optional(),
    week: z
      .string()
      .transform((v) => (v ?? '').toLowerCase().trim())
      .refine((v) => !v || WEEK_VALUES_AVAIL.includes(v), {
        message: `week debe ser "${WEEK_VALUES_AVAIL.join('", "')}"`,
      })
      .optional(),
    service: z.enum(AVAILABILITY_SERVICES).optional(),
    nailsTechnique: z.enum(NAILS_TECHNIQUES_AVAIL).optional(),
  })
  .refine(
    (data) => {
      const svc = (data.service ?? '').toLowerCase();
      if (svc === 'uñas' || svc === 'unas') return !!data.nailsTechnique;
      return true;
    },
    { message: 'nailsTechnique is required when service is uñas', path: ['nailsTechnique'] }
  );

// --- Booking (fixed capacity): service = uñas|pedicura|pestañas|tinte|corte ---
// Cuando service=uñas, nailsTechnique (gel|softgel|acrilico) es requerido
// week: actual|current|siguiente|next - semana donde crear la reserva
export const bookingFixedSchema = z
  .object({
    day: z
      .string()
      .transform((v) => {
        const d = (v ?? '').toLowerCase().trim();
        return SPANISH_DAYS[d] ?? (['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(d) ? d : v);
      })
      .pipe(fixedDaySchema),
    slot: z.number().int().min(11).max(20),
    service: z.enum(AVAILABILITY_SERVICES),
    nailsTechnique: z.enum(NAILS_TECHNIQUES_AVAIL).optional(),
    week: z
      .string()
      .transform((v) => (v ?? '').toLowerCase().trim())
      .refine((v) => !v || WEEK_VALUES_AVAIL.includes(v), {
        message: `week debe ser "${WEEK_VALUES_AVAIL.join('", "')}"`,
      })
      .optional(),
    customerName: z.string().optional(),
    customerInstagram: z.string().optional(),
    phoneNumber: z.string().optional(),
  })
  .refine(
    (data) => {
      const svc = (data.service ?? '').toLowerCase();
      if (svc === 'uñas' || svc === 'unas') return !!data.nailsTechnique;
      return true;
    },
    { message: 'nailsTechnique is required when service is uñas', path: ['nailsTechnique'] }
  );

// --- Booking ---
export const bookingSchema = z.object({
  day: daySchema,
  slot: z.number().int().min(MIN_HOUR).max(MAX_HOUR),
  serviceName: z.string().min(1, 'serviceName is required'),
  nailsTechnique: z.enum(NAILS_TECHNIQUES).optional(),
  customerName: z.string().optional(),
  customerInstagram: z.string().optional(),
  phoneNumber: z.string().optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  weekNumber: z.coerce.number().int().min(1).max(53).optional(),
});

// --- Technician schedule query (GET own availability) ---
export const technicianScheduleQuerySchema = z.object({
  technicianId: z.string().min(1, 'technicianId is required'),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  weekNumber: z.coerce.number().int().min(1).max(53).optional(),
  day: daySchema.optional(),
});

// --- Update technician schedule (replace day slots) ---
export const updateTechnicianScheduleSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  weekNumber: z.coerce.number().int().min(1).max(53).optional(),
  technicianId: z.string().min(1, 'technicianId is required'),
  day: daySchema,
  slots: z.array(z.number().int().min(MIN_HOUR).max(MAX_HOUR)).refine(
    (arr) => new Set(arr).size === arr.length,
    { message: 'Slots must be unique' }
  ),
});

// Map serviceName to role for technician filtering (assign flow)
export const SERVICE_NAME_TO_ROLE = {
  uñas: 'nails',
  unas: 'nails',
  pestañas: 'lashes',
  pestanas: 'lashes',
  pedicura: 'nails',
  cejas: 'brows',
};

export function getAssignFilterFromBooking(booking) {
  const serviceName = (booking.serviceName ?? '').toLowerCase().trim();
  const role = SERVICE_NAME_TO_ROLE[serviceName] ?? 'nails';
  const service = booking.nailsTechnique ?? booking.service ?? undefined;
  return { service, role };
}

// --- Assign booking ---
export const assignBookingSchema = z.object({
  bookingId: z.string().uuid(),
  technicianId: z.string().min(1, 'technician id is required'),
  technicianName: z.string().optional(),
});
