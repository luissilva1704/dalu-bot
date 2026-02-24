/**
 * Sends booking data to a Google Sheets webhook.
 * Configure GOOGLE_SHEETS_WEBHOOK_URL in your environment.
 * If not set, the function does nothing.
 * Failures are logged but do not throw (fire-and-forget).
 */

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const GOOGLE_SHEETS_SECRET = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

/**
 * @param {Object} booking - Pre-reserve booking data
 * @param {string} booking.bookingId
 * @param {number} booking.year
 * @param {number} booking.weekNumber
 * @param {string} booking.day
 * @param {number} booking.slotHour
 * @param {string} booking.service
 * @param {string} [booking.role]
 * @param {string} [booking.customerName]
 * @param {string} [booking.customerInstagram]
 * @param {string} booking.status
 * @param {string} booking.createdAt
 */
export async function sendBookingToGoogleSheets(booking,year,weekNumber,day,slot,month,dayOfMonth) {
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
        año: year,
        mes: month,
        dia: dayOfMonth,
        dia_semana: day,
        hora_inicio: booking.slotHour.toString(),
        fecha_hora_reserva: booking.createdAt,
        usuario_instagram: booking.customerInstagram,
        npmbre_usuario: booking.customerName,
        id_tecnica: "Por asignar",
        nombre_tecnica: "Por asignar",
        servicio: booking.service,
        estatus: "PENDING_ASSIGNMENT",
        origen: "Instagram",
        monto_total: 0,
        nota: "Cita pre-reservada por Instagram"
      },
    ],
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log("response from sheets", response);

    if (!response.ok) {
      console.warn(
        `[googleSheetsWebhook] Webhook returned ${response.status} for booking ${booking.bookingId}`
      );
    }
  } catch (err) {
    console.warn(`[googleSheetsWebhook] Failed to send booking ${booking.bookingId}:`, err.message);
  }
}
