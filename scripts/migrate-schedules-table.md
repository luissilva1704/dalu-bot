# Migración: tabla Schedules al nuevo esquema

## Problema
Si tu tabla `dalu-schedules` fue creada con el esquema antiguo (`day` como HASH, sin sort key), cada técnico sobrescribe al anterior cuando registra el mismo día. Solo puede existir **un item por día**.

## Solución
Recrear la tabla con el esquema nuevo: `pk` (HASH) + `sk` (RANGE).

---

## Opción 1: AWS CLI (recomendado)

### Paso 1: Eliminar la tabla antigua
```bash
aws dynamodb delete-table --table-name dalu-schedules --region us-east-1
```
Espera unos segundos hasta que el estado sea "DELETED".

### Paso 2: Crear la tabla con el esquema nuevo
```bash
aws dynamodb create-table \
  --table-name dalu-schedules \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Paso 3: Verificar
```bash
aws dynamodb describe-table --table-name dalu-schedules --region us-east-1
```
Debes ver en `KeySchema`:
- `pk` (HASH)
- `sk` (RANGE)

---

## Opción 2: Si NO quieres borrar datos

Si tienes datos en la tabla antigua que necesitas conservar (formato viejo sin técnicos), puedes:

1. Exportar manualmente los datos (scan)
2. Eliminar la tabla
3. Crear la nueva
4. Re-importar en el formato nuevo (un técnico "default")

O usar una tabla con **nombre distinto** para la nueva:

```bash
# Crear tabla nueva con otro nombre
aws dynamodb create-table \
  --table-name dalu-schedules-v2 \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Luego en tu `.env`:
```
DYNAMO_TABLE_SCHEDULES=dalu-schedules-v2
```

---

## Después de migrar

1. Registra de nuevo los horarios de cada técnica.
2. Cada técnico tendrá su propio item gracias a `sk = "T#technicianId"`.
3. Ejemplo de items en la nueva tabla para lunes, semana 5, 2026:
   - `pk: "W#2026#5#D#monday"`, `sk: "T#tech_1"` → Técnica 1
   - `pk: "W#2026#5#D#monday"`, `sk: "T#tech_2"` → Técnica 2
