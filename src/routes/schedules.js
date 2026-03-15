import express from 'express';
import schedulesRepo from '../repositories/schedulesRepo.js';
import capacityRepo from '../repositories/capacityRepo.js';
import bookingsRepo from '../repositories/bookingsRepo.js';
import {
  createScheduleSchema,
  updateTechnicianScheduleSchema,
  technicianScheduleQuerySchema,
  resetWeekSchema,
} from '../validators/scheduleValidators.js';
import { getCurrentWeekMexico, getWeekOffsetMexico } from '../utils/week.js';
import { normalizeDay } from '../utils/dayMapping.js';

function formatSlotsAsHhMm(slots) {
  return (slots ?? []).map((s) => `${String(s).padStart(2, '0')}:00`).join(',');
}

const router = express.Router();

// --- NEW: Fixed weekly capacity (admin-managed, NO technicians) ---
// Resetea la semana actual y crea capacidad para las dos semanas siguientes (12 y 13).
router.post('/reset-week', async (req, res, next) => {
  try {
    resetWeekSchema.parse(req.body ?? {});
    const current = getCurrentWeekMexico();
    const week1 = getWeekOffsetMexico(1); // siguiente
    const week2 = getWeekOffsetMexico(2); // siguiente+1

    await capacityRepo.deleteWeek([current, week1, week2]);
    // Ejecutar ambas semanas en paralelo
    const [summary1, summary2] = await Promise.all([
      capacityRepo.resetWeek(week1.year, week1.weekNumber),
      capacityRepo.resetWeek(week2.year, week2.weekNumber),
    ]);

    res.json({
      message: 'Week capacity reset successfully (2 weeks)',
      weeksCreated: [
        { year: week1.year, weekNumber: week1.weekNumber, ...summary1 },
        { year: week2.year, weekNumber: week2.weekNumber, ...summary2 },
      ],
    });
  } catch (error) {
    console.error('reset-week error:', error?.name, error?.message, error?.$metadata ?? error?.code);
    next(error);
  }
});

// --- DEPRECATED: Technician-based routes (fixed capacity model - no technicians) ---
router.get('/technician', (req, res) => {
  res.status(410).json({
    error: 'Gone',
    message: 'GET /api/schedules/technician is deprecated. Use POST /api/schedules/reset-week for fixed capacity.',
  });
});

router.put('/technician', (req, res) => {
  res.status(410).json({
    error: 'Gone',
    message: 'PUT /api/schedules/technician is deprecated. Use POST /api/schedules/reset-week for fixed capacity.',
  });
});

// DEPRECATED: POST / - use reset-week for fixed capacity
router.post('/', (req, res) => {
  res.status(410).json({
    error: 'Gone',
    message: 'POST /api/schedules is deprecated. Use POST /api/schedules/reset-week for fixed capacity (no technicians).',
  });
});

export default router;
