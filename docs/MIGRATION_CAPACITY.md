# Migración: Capa de Capacidad Agregada

## Cambios principales

1. **Nueva tabla `dalu-capacity`**: Capacidad agregada por semana/día/slot (sin técnica)
2. **Bookings en 2 pasos**: Pre-reserva (sin técnica) + Assign (asignar técnica)
3. **Availability** lee solo de `dalu-capacity`
4. **Schedules POST** actualiza `dalu-capacity` automáticamente al calcular delta

## Si ya tienes tablas creadas

### Bookings: agregar GSI `byBookingId`

Si tu tabla `dalu-bookings` no tiene el GSI, agrégalo:

```bash
aws dynamodb update-table \
  --table-name dalu-bookings \
  --attribute-definitions AttributeName=bookingId,AttributeType=S \
  --global-secondary-index-updates '[
    {
      "Create": {
        "IndexName": "byBookingId",
        "KeySchema": [{"AttributeName":"bookingId","KeyType":"HASH"}],
        "Projection": {"ProjectionType":"ALL"}
      }
    }
  ]' \
  --region us-east-1
```

Espera a que el GSI esté en estado `ACTIVE` antes de usar.

### Capacity: crear tabla nueva

```bash
aws dynamodb create-table \
  --table-name dalu-capacity \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Variables de entorno

Agrega a `.env`:
```
DYNAMO_TABLE_CAPACITY=dalu-capacity
```

## Datos existentes

- **Schedules**: Sin cambios. Ejecuta POST schedules de nuevo para poblar `dalu-capacity`.
- **Bookings**: Los bookings viejos (con technicianId) no tienen `bookingId` ni `status`. El flujo nuevo crea bookings con `PENDING_ASSIGNMENT`. Puedes dejarlos o migrarlos manualmente.
