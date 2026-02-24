# API Examples - Technician Weekly Availability

## Setup (crear tablas)

Requeridas: dalu-schedules, dalu-bookings (con GSI byBookingId), dalu-capacity.

Variables de entorno:
```
DYNAMO_TABLE_SCHEDULES=dalu-schedules
DYNAMO_TABLE_BOOKINGS=dalu-bookings
DYNAMO_TABLE_CAPACITY=dalu-capacity
```

Las tablas deben usar el nuevo esquema:
- **Schedules**: `pk` (HASH), `sk` (RANGE)
- **Bookings**: `pk` (HASH), `sk` (RANGE)

Si ya tienes tablas con el esquema viejo (`day` como HASH en Schedules), debes recrearlas.
Ver `cloudformation/dynamodb-tables.yaml` actualizado.

---

## 1. POST /api/schedules - Subir disponibilidad de 3 técnicas

### Técnica 1 (Tania)
```bash
curl -X POST https://YOUR_API_URL/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "weekNumber": 5,
    "technician": {
      "id": "tech_1",
      "name": "Tania",
      "role": "nails",
      "services": ["acrilico", "softgel"]
    },
    "availability": [
      { "day": "monday", "slots": [11, 12, 13, 14, 15] },
      { "day": "tuesday", "slots": [11, 14, 15, 16] }
    ]
  }'
```

### Técnica 2 (María)
```bash
curl -X POST https://YOUR_API_URL/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "weekNumber": 5,
    "technician": {
      "id": "tech_2",
      "name": "María",
      "role": "nails",
      "services": ["acrilico", "gel"]
    },
    "availability": [
      { "day": "monday", "slots": [11, 12, 13] },
      { "day": "tuesday", "slots": [14, 15, 16, 17] }
    ]
  }'
```

### Técnica 3 (Lupita)
```bash
curl -X POST https://YOUR_API_URL/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "weekNumber": 5,
    "technician": {
      "id": "tech_3",
      "name": "Lupita",
      "role": "nails",
      "services": ["acrilico", "softgel", "rubber"]
    },
    "availability": [
      { "day": "monday", "slots": [11, 12, 13, 14, 15, 16] }
    ]
  }'
```

### Borrar slots de un día (enviar array vacío)
```bash
curl -X POST https://YOUR_API_URL/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "weekNumber": 5,
    "technician": {
      "id": "tech_1",
      "name": "Tania",
      "role": "nails",
      "services": ["acrilico"]
    },
    "availability": [
      { "day": "tuesday", "slots": [] }
    ]
  }'
```

---

## 2. GET /api/availability - Consultar disponibilidad con capacidad

### Un día (semana actual, service=acrilico)
```bash
curl "https://YOUR_API_URL/api/availability?day=monday&service=acrilico"
```

### Con week y year explícitos
```bash
curl "https://YOUR_API_URL/api/availability?day=monday&service=acrilico&year=2026&weekNumber=5"
```

### Respuesta ejemplo (día específico)
```json
{
  "day": "monday",
  "service": "acrilico",
  "weekNumber": 5,
  "year": 2026,
  "slots": [
    { "slot": 11, "capacityTotal": 3, "capacityAvailable": 3 },
    { "slot": 12, "capacityTotal": 3, "capacityAvailable": 2 },
    { "slot": 13, "capacityTotal": 3, "capacityAvailable": 1 }
  ],
  "availableSlots": "11,12,13",
  "bookedSlots": [12, 13]
}
```

### Todos los días
```bash
curl "https://YOUR_API_URL/api/availability?service=acrilico&year=2026&weekNumber=5"
```

### Día en español
```bash
curl "https://YOUR_API_URL/api/availability?day=lunes&service=acrilico"
```

---

## 3. PUT /api/bookings - Pre-reserva (sin técnica)

Crea una reserva consumiendo capacidad agregada. La técnica se asigna después con PUT /api/bookings/assign.

### Primera reserva (asigna tech_1)
```bash
curl -X POST https://YOUR_API_URL/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "monday",
    "slot": 11,
    "service": "acrilico",
    "customerName": "Cliente 1",
    "customerInstagram": "@cliente1"
  }'
```

### Segunda reserva (asigna tech_2 u otra técnica disponible)
```bash
curl -X PUT https://YOUR_API_URL/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "monday",
    "slot": 11,
    "service": "acrilico",
    "customerName": "Cliente 2",
    "customerInstagram": "@cliente2"
  }'
```

### Tercera reserva (asigna tech_3)
```bash
curl -X PUT https://YOUR_API_URL/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "monday",
    "slot": 11,
    "service": "acrilico",
    "customerName": "Cliente 3",
    "customerInstagram": "@cliente3"
  }'
```

### Cuarta reserva → 409 Conflict (no hay capacidad)
```bash
curl -X PUT https://YOUR_API_URL/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "monday",
    "slot": 11,
    "service": "acrilico",
    "customerName": "Cliente 4"
  }'
```

**Respuesta 409:**
```json
{
  "error": "No capacity",
  "message": "Slot 11 is fully booked for monday."
}
```

---

## 4. PUT /api/bookings/assign - Asignar técnica a reserva

Usa el `bookingId` devuelto al crear la pre-reserva.

```bash
curl -X PUT https://YOUR_API_URL/api/bookings/assign \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "abc-123-uuid-del-response",
    "technicianId": "tech_1",
    "technicianName": "Tania"
  }'
```

**Respuesta 200:**
```json
{
  "message": "Technician assigned successfully",
  "booking": {
    "bookingId": "abc-123-...",
    "day": "monday",
    "slot": 11,
    "service": "acrilico",
    "status": "CONFIRMED",
    "technicianId": "tech_1",
    "technicianName": "Tania",
    "updatedAt": "..."
  }
}
```

**409** si la técnica ya no tiene ese slot o el booking ya fue asignado.

### Con week/year explícitos
```bash
curl -X PUT https://YOUR_API_URL/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "monday",
    "slot": 12,
    "service": "acrilico",
    "customerName": "Test",
    "year": 2026,
    "weekNumber": 5
  }'
```

---

## Errores comunes

| Código | Causa |
|--------|-------|
| 400 | Payload inválido, día/slot/service incorrecto |
| 404 | No hay schedules para ese día/semana |
| 409 | Slot sin capacidad disponible (técnicas todas ocupadas) |
