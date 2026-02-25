import { z } from 'zod';

const MIN_HOUR = 11;
const MAX_HOUR = 18;

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

// --- Availability query ---
export const availabilityQuerySchema = z.object({
  day: daySchema.optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  weekNumber: z.coerce.number().int().min(1).max(53).optional(),
  service: z.enum(SERVICES),
  role: z.enum(ROLES).optional(),
});

// --- Booking ---
export const bookingSchema = z.object({
  day: daySchema,
  slot: z.number().int().min(MIN_HOUR).max(MAX_HOUR),
  service: z.enum(SERVICES),
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

// --- Assign booking ---
export const assignBookingSchema = z.object({
  bookingId: z.string().uuid(),
  technicianId: z.string().min(1, 'technician id is required'),
  technicianName: z.string().optional(),
});
