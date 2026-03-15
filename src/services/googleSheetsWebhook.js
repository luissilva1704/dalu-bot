/**
 * Sends booking data to a Google Sheets webhook.
 * Configure GOOGLE_SHEETS_WEBHOOK_URL in your environment.
 * If not set, the function does nothing.
 * Failures are logged but do not throw (fire-and-forget).
 */

import { toSpanishDay } from '../utils/dayMapping.js';

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const GOOGLE_SHEETS_SECRET = process.env.GOOGLE_SHEETS_SECRET;

/**
 * @param {Object} booking - Pre-reserve booking data
 * @param {string} booking.bookingId
 * @param {number} booking.year
 * @param {number} booking.weekNumber
 * @param {string} booking.day
 * @param {number} booking.slotHour
 * @param {string} booking.serviceName
 * @param {string} [booking.nailsTechnique]
 * @param {string} [booking.role]
 * @param {string} [booking.customerName]
 * @param {string} [booking.customerInstagram]
 * @param {string} booking.status
 * @param {string} booking.createdAt
 */
export async function sendBookingToGoogleSheets(booking,year,day,month,dayOfMonth) {
  if (!WEBHOOK_URL || WEBHOOK_URL.trim() === '') {
    return;
  }

  const payload = {
    secret: GOOGLE_SHEETS_SECRET,
    entity: 'appointments',
    mode: 'append',
    records: [
      {
        id_cita: booking.bookingId,
        Año: year,
        Mes: month,
        Dia: dayOfMonth,
        Dia_semana: toSpanishDay(day),
        Hora_inicio: (booking.slotStart ?? booking.slotHour ?? 0).toString() + ":00",
        Fecha_hora_reserva: booking.createdAt,
        Usuario_instagram: booking.customerInstagram,
        Nombre_usuario: booking.customerName,
        Telefono: booking.phoneNumber ?? null,
        id_tecnica: "Por asignar",
        Nombre_tecnica: "Por asignar",
        Servicio: booking.service,
        Tecnica_uñas: booking.nailsTechnique ?? null,
        //Duracion_horas: booking.durationHours ?? null,
        //Slots_bloqueados: booking.slotsBlocked ? booking.slotsBlocked.join(',') : null,
        Estatus: "Confirmada - pendiente de asignación",
        Origen: "Instagram - Bot",
        Monto_total: 0,
        Nota: "Validar Deposito y Confirmar Asignación"
      },
    ],
  };
  console.log('payloadToSheets', payload);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    let bodyJson = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = bodyText;
    }
    console.log('[googleSheetsWebhook] response status:', response.status, 'body:', bodyJson);

    if (!response.ok) {
      console.warn(
        `[googleSheetsWebhook] Webhook returned ${response.status} for booking ${booking.bookingId}`
      );
    }
  } catch (err) {
    console.warn(`[googleSheetsWebhook] Failed to send booking ${booking.bookingId}:`, err.message);
  }
}
