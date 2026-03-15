# API Examples - Fixed Weekly Capacity

Sistema de capacidad fija administrada por admins. Sin lógica por técnica.

## Setup (crear tablas)

Requeridas: dalu-capacity, dalu-bookings (con GSI byBookingId).

Variables de entorno:
```
DYNAMO_TABLE_SCHEDULES=dalu-schedules
DYNAMO_TABLE_BOOKINGS=dalu-bookings
DYNAMO_TABLE_CAPACITY=dalu-capacity
```

**dalu-schedules** queda deprecada (el sistema usa solo dalu-capacity para disponibilidad).

---

## 1. POST /api/schedules/reset-week - Resetear capacidad semanal

Permite a los administradores resetear la capacidad con horarios fijos: martes a sábado, slots 11-20, capacidad 2 por slot. Permite reservar hasta las 18 como hora de inicio (incluso servicios de 3h). No requiere parámetros. **Borra la semana actual y crea las dos semanas siguientes** (ej: si estamos en semana 11, borra semana 11 y crea semanas 12 y 13). Pensado para ejecutarse los sábados o domingos (America/Mexico_City).

```bash
curl -X POST https://YOUR_API_URL/api/schedules/reset-week \
  -H "Content-Type: application/json"
```

**Respuesta 200:**
```json
{
  "message": "Week capacity reset successfully (2 weeks)",
  "weeksCreated": [
    {
      "year": 2026,
      "weekNumber": 12,
      "daysProcessed": 5,
      "slotsPerDay": 10,
      "totalSlots": 50
    },
    {
      "year": 2026,
      "weekNumber": 13,
      "daysProcessed": 5,
      "slotsPerDay": 10,
      "totalSlots": 50
    }
  ]
}
```

---

## 2. GET /api/week-days - Días disponibles formateados

Devuelve los días con disponibilidad en dalu-capacity como texto en español con el número del mes. Útil para mostrar al usuario qué días puede reservar en una semana. Solo incluye días que tienen datos en la tabla de capacidad.

**week** (query, requerido): `actual`, `current`, `siguiente` o `next`

```bash
# Semana actual
curl "https://YOUR_API_URL/api/week-days?week=actual"
```

```bash
# Semana siguiente
curl "https://YOUR_API_URL/api/week-days?week=siguiente"
```

```bash
# Alternativas en inglés
curl "https://YOUR_API_URL/api/week-days?week=current"
curl "https://YOUR_API_URL/api/week-days?week=next"
```

**Respuesta 200:**
```json
{
  "week": "siguiente",
  "year": 2026,
  "weekNumber": 12,
  "days": "Martes 17, Miércoles 18, Jueves 19, Viernes 20, Sábado 21"
}
```

Si no hay capacidad para ningún día, `days` será una cadena vacía.

**400** si `week` es inválido o falta:
```json
{
  "error": "Bad request",
  "message": "week debe ser \"actual\", \"current\", \"siguiente\" o \"next\""
}
```

---

## 3. GET /api/availability - Consultar disponibilidad

Lee solo de dalu-capacity. Con `service` calcula `canStartBooking` según duración del servicio.

**service** (opcional): uñas, pedicura, pestañas, tinte, corte  
**nailsTechnique** (requerido cuando service=uñas): gel, softgel, acrilico

### Uñas con acrílico (3h)
```bash
curl "https://YOUR_API_URL/api/availability?day=tuesday&service=uñas&nailsTechnique=acrilico&year=2026&weekNumber=5"
```

### Uñas con gel (2h)
```bash
curl "https://YOUR_API_URL/api/availability?day=tuesday&service=uñas&nailsTechnique=gel&year=2026&weekNumber=5"
```

### Pedicura (2h), pestañas (3h), tinte (1h) o corte (1h)
```bash
curl "https://YOUR_API_URL/api/availability?day=tuesday&service=pedicura&year=2026&weekNumber=5"
```

### Sin servicio (capacidad simple)
```bash
curl "https://YOUR_API_URL/api/availability?day=tuesday&year=2026&weekNumber=5"
```

### Todos los días de la semana
```bash
curl "https://YOUR_API_URL/api/availability?service=uñas&nailsTechnique=acrilico&year=2026&weekNumber=5"
```

**Respuesta 200 (día específico con service):**
```json
{
  "day": "tuesday",
  "service": "uñas",
  "nailsTechnique": "acrilico",
  "year": 2026,
  "weekNumber": 5,
  "slots": [
    { "slot": 11, "capacityTotal": 2, "capacityAvailable": 2, "canStartBooking": true },
    { "slot": 12, "capacityTotal": 2, "capacityAvailable": 2, "canStartBooking": true },
    { "slot": 17, "capacityTotal": 2, "capacityAvailable": 1, "canStartBooking": false }
  ],
  "availableStartSlots": "11:00, 12:00, 14:00"
}
```

- **canStartBooking**: true si hay capacidad en el slot y los siguientes (según duración del servicio)
- **availableStartSlots**: slots donde puede iniciar una cita del servicio indicado

Días válidos: tuesday, wednesday, thursday, friday, saturday.

---

## 4. PUT /api/bookings - Crear reserva

Bloquea múltiples slots consecutivos según la duración del servicio. Sin asignación de técnica.

| Servicio  | nailsTechnique | Duración | Slots bloqueados (ej. inicio 11) |
|-----------|----------------|----------|----------------------------------|
| uñas      | acrilico       | 3h       | 11, 12, 13                       |
| uñas      | gel / softgel  | 2h       | 11, 12                           |
| pestañas  | —              | 3h       | 11, 12, 13                       |
| pedicura  | —              | 2h       | 11, 12                           |
| tinte     | —              | 1h       | 11                                |
| corte     | —              | 1h       | 11                                |

**service**: uñas, pedicura, pestañas, tinte, corte  
**nailsTechnique** (requerido cuando service=uñas): gel, softgel, acrilico

```bash
# Uñas con acrílico
curl -X PUT https://YOUR_API_URL/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "tuesday",
    "slot": 11,
    "service": "uñas",
    "nailsTechnique": "acrilico",
    "customerName": "Ana",
    "customerInstagram": "@ana",
    "phoneNumber": "+52 55 1234 5678"
  }'
```

```bash
# Pedicura (sin nailsTechnique)
curl -X PUT https://YOUR_API_URL/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "tuesday",
    "slot": 14,
    "service": "pedicura",
    "customerName": "María",
    "phoneNumber": "+52 55 9999 0000"
  }'
```

**Respuesta 201:**
```json
{
  "message": "Booking created successfully",
  "booking": {
    "bookingId": "uuid-...",
    "day": "tuesday",
    "slotStart": 11,
    "slotsBlocked": [11, 12, 13],
    "service": "uñas",
    "nailsTechnique": "acrilico",
    "durationHours": 3,
    "status": "CONFIRMED",
    "customerName": "Ana",
    "customerInstagram": "@ana",
    "phoneNumber": "+52 55 1234 5678",
    "createdAt": "2026-02-21T15:30:00-06:00"
  },
  "availability": {
    "day": "tuesday",
    "availableStartSlots": "12:00, 14:00, 15:00, 16:00"
  }
}
```

**409** si alguno de los slots requeridos no tiene disponibilidad:
```json
{
  "error": "No capacity",
  "message": "Not enough capacity for acrilico at 17. Required slots 17,18,19 - slot 19 does not exist."
}
```

Usa siempre la semana actual (America/Mexico_City).

---

## Errores comunes

| Código | Causa |
|--------|-------|
| 400 | Payload inválido, día/slot/service incorrecto |
| 404 | No hay capacidad (resetear semana primero) |
| 409 | No hay capacidad suficiente en los slots del servicio |
