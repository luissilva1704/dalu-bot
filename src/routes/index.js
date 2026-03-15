import express from 'express';
import schedulesRouter from './schedules.js';
import availabilityRouter from './availability.js';
import bookingsRouter from './bookings.js';
import weekDaysRouter from './weekDays.js';

const router = express.Router();

router.use('/schedules', schedulesRouter);
router.use('/availability', availabilityRouter);
router.use('/bookings', bookingsRouter);
router.use('/week-days', weekDaysRouter);

export default router;
