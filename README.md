# Dalu Back Bot - API de Horarios y Reservas

API backend en Node.js + Express para gestión de horarios disponibles y reservas de un estudio de uñas.

## 🚀 Stack Tecnológico

- **Node.js** + **Express** (ESM)
- **AWS DynamoDB** (NoSQL database)
- **AWS SDK v3** (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb)
- **Zod** (validación de datos)
- **CORS** habilitado

## 📋 Requisitos Previos

- Node.js 18+
- AWS Account con DynamoDB access
- AWS CLI configurado (para crear tablas)
- Credenciales AWS (Access Key ID y Secret Access Key)

## 🔧 Instalación

1. **Clonar e instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:
```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# DynamoDB Table Names
DYNAMO_TABLE_SCHEDULES=dalu-schedules
DYNAMO_TABLE_BOOKINGS=dalu-bookings

# OpenAI (para endpoint de quotes)
OPENAI_API_KEY=your_openai_api_key_here

# Server
PORT=3000
NODE_ENV=development
```

**⚠️ IMPORTANTE:** Nunca commitees el archivo `.env` con credenciales reales. El archivo está en `.gitignore`.

3. **Crear tablas en DynamoDB:**

**⚠️ IMPORTANTE:** La tabla Schedules debe usar `pk` (HASH) + `sk` (RANGE). Si tienes una tabla antigua con `day` como HASH, las técnicas se sobrescribirán. Debes recrearla. Ver `scripts/migrate-schedules-table.md`.

Tienes dos opciones:

**Opción A: Usando AWS CLI (recomendado para desarrollo local)**
```bash
npm run setup:tables
```

O manualmente:
```bash
# Crear tabla Schedules (pk = W#year#week#D#day, sk = T#technicianId)
aws dynamodb create-table \
  --table-name dalu-schedules \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Crear tabla Bookings (pk = W#year#week#D#day, sk = SLOT#hour#T#technicianId)
aws dynamodb create-table \
  --table-name dalu-bookings \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Opción B: Usando CloudFormation (recomendado para producción)**
```bash
aws cloudformation create-stack \
  --stack-name dalu-dynamodb-tables \
  --template-body file://cloudformation/dynamodb-tables.yaml \
  --parameters ParameterKey=SchedulesTableName,ParameterValue=dalu-schedules \
               ParameterKey=BookingsTableName,ParameterValue=dalu-bookings \
  --region us-east-1
```

4. **Iniciar servidor:**
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 📚 Endpoints

### 1. POST /api/schedules
Cargar o actualizar disponibilidad semanal por técnica.

**Request:**
```bash
curl -X POST http://localhost:3000/api/schedules \
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

**Response:**
```json
{
  "message": "Schedules updated successfully",
  "year": 2026,
  "weekNumber": 5,
  "technicianId": "tech_1",
  "schedules": [
    { "day": "monday", "slots": [11, 12, 13, 14, 15], "technicianId": "tech_1" },
    { "day": "tuesday", "slots": [11, 14, 15, 16], "technicianId": "tech_1" }
  ]
}
```

### 2. GET /api/availability
Consultar disponibilidad con capacidad por slot. Requiere `service`.

**Obtener un día:**
```bash
curl "http://localhost:3000/api/availability?day=monday&service=acrilico"
```

**Con semana explícita:**
```bash
curl "http://localhost:3000/api/availability?day=monday&service=acrilico&year=2026&weekNumber=5"
```

**Todos los días:**
```bash
curl "http://localhost:3000/api/availability?service=acrilico&year=2026&weekNumber=5"
```

**Response (día específico):**
```json
{
  "day": "monday",
  "service": "acrilico",
  "weekNumber": 5,
  "year": 2026,
  "slots": [
    { "slot": 11, "capacityTotal": 3, "capacityAvailable": 2 },
    { "slot": 12, "capacityTotal": 3, "capacityAvailable": 3 }
  ],
  "availableSlots": "11,12",
  "bookedSlots": [11]
}
```

### 3. PUT /api/bookings
Crear una reserva (asigna automáticamente una técnica disponible).

**Request:**
```bash
curl -X PUT http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "day": "monday",
    "slot": 15,
    "service": "acrilico",
    "customerName": "Ana García",
    "customerInstagram": "@ana_garcia"
  }'
```

**Response:**
```json
{
  "message": "Booking created successfully",
  "booking": {
    "day": "monday",
    "slot": 15,
    "technicianId": "tech_1",
    "technicianName": "Tania",
    "service": "acrilico",
    "customerName": "Ana García",
    "customerInstagram": "@ana_garcia",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "availability": {
    "day": "monday",
    "availableSlots": "11,12,14",
    "bookedSlots": [13, 15, 16, 17, 18, 19]
  }
}
```

**Errores comunes:**
- `400`: Payload inválido o `service` faltante en availability
- `404`: No hay schedules para ese día/semana
- `409 Conflict`: Slot sin capacidad (todas las técnicas ocupadas)

Ver `docs/API_EXAMPLES.md` para ejemplos completos con curl.
- `404 Not Found`: No existe schedule para ese día
- `400 Bad Request`: El slot no está en los horarios configurados

## 🗄️ Estructura de Base de Datos (DynamoDB)

### Tabla `Schedules` (DYNAMO_TABLE_SCHEDULES)
- **Partition Key (PK)**: `pk` (String) = `"W#<year>#<weekNumber>#D#<day>"`
- **Sort Key (SK)**: `sk` (String) = `"T#<technicianId>"`
- **Attributes**:
  - `slots`: List<Number> - Horas disponibles (11-19)
  - `services`: List<String> - ej: ["acrilico","softgel"]
  - `role`: String - ej: "nails", "lashes", "brows"
  - `technicianName`: String (opcional)
  - `updatedAt`: String (ISO 8601)

### Tabla `Bookings` (DYNAMO_TABLE_BOOKINGS)
- **Partition Key (PK)**: `pk` (String) = `"W#<year>#<weekNumber>#D#<day>"`
- **Sort Key (SK)**: `sk` (String) = `"SLOT#<hour>#T#<technicianId>"`
- **Attributes**:
  - `day`, `slotHour`, `technicianId`, `technicianName`, `service`
  - `customerName`, `customerInstagram` (opcional)
  - `createdAt`: String (ISO 8601)
- **Constraint**: `ConditionExpression` previene doble reserva por técnica (escritura atómica)

## 🔒 Seguridad y Prevención de Doble Reserva

El sistema usa **ConditionExpression** de DynamoDB para garantizar escrituras atómicas:

```javascript
ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
```

Esto asegura que:
- Si dos requests intentan reservar el mismo slot simultáneamente, solo una tendrá éxito
- La otra recibirá `409 Conflict` automáticamente
- No se requiere locking adicional a nivel de aplicación

## 🛠️ Comandos Útiles

```bash
# Desarrollo
npm run dev

# Crear tablas DynamoDB
npm run setup:tables

# Verificar tablas creadas
aws dynamodb list-tables --region us-east-1

# Ver items en una tabla
aws dynamodb scan --table-name dalu-schedules --region us-east-1
aws dynamodb scan --table-name dalu-bookings --region us-east-1
```

## 📝 Validaciones

- **Días válidos**: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`
- **Horas válidas**: 11 a 19 (enteros)
- **Slots únicos**: No se permiten duplicados en el array de slots
- **Reservas atómicas**: DynamoDB ConditionExpression previene doble reserva

## 🔒 Manejo de Errores

Todos los errores se manejan de forma centralizada y devuelven respuestas JSON consistentes:

```json
{
  "error": "Validation error",
  "details": [
    {
      "path": "schedules[0].day",
      "message": "Invalid enum value"
    }
  ]
}
```

## 🧪 Testing

Ejemplos de uso con curl están incluidos en este README. Para pruebas más exhaustivas:

1. **Crear horarios:**
```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{"schedules":[{"day":"monday","slots":[11,12,13,14,15,16,17,18,19]}]}'
```

2. **Consultar disponibilidad:**
```bash
curl "http://localhost:3000/api/availability?day=monday"
```

3. **Crear reserva:**
```bash
curl -X PUT http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"day":"monday","slot":15,"customerName":"Test User"}'
```

4. **Verificar que el slot está bloqueado:**
```bash
curl "http://localhost:3000/api/availability?day=monday"
```

5. **Intentar doble reserva (debe fallar con 409):**
```bash
curl -X PUT http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"day":"monday","slot":15,"customerName":"Another User"}'
```

## 📁 Estructura del Proyecto

```
dalu_back_bot/
├── cloudformation/
│   └── dynamodb-tables.yaml      # CloudFormation template para tablas
├── scripts/
│   └── setup-dynamodb-tables.js  # Script para crear tablas vía CLI
├── src/
│   ├── db/
│   │   └── dynamo.js              # Cliente DynamoDB configurado
│   ├── repositories/
│   │   ├── schedulesRepo.js       # Lógica de acceso a Schedules
│   │   └── bookingsRepo.js        # Lógica de acceso a Bookings
│   ├── middleware/
│   │   ├── errorHandler.js        # Manejo centralizado de errores
│   │   └── logger.js               # Logging de requests
│   ├── routes/
│   │   ├── schedules.js           # POST /api/schedules
│   │   ├── availability.js         # GET /api/availability
│   │   ├── bookings.js             # PUT /api/bookings
│   │   └── index.js                # Router principal
│   ├── utils/
│   │   └── days.js                 # Utilidades para días de la semana
│   └── validators/
│       └── scheduleValidators.js  # Schemas de validación Zod
├── index.js                        # Servidor Express principal
├── ai.js                           # Análisis de uñas con IA
├── prices.js                       # Precios y reglas
└── package.json
```

## 🚨 Notas Importantes

- **Credenciales AWS**: Nunca commitees credenciales. Usa variables de entorno o AWS IAM roles.
- **Billing**: Las tablas usan `PAY_PER_REQUEST` (on-demand), solo pagas por lo que usas.
- **Región**: Asegúrate de que `AWS_REGION` coincida con donde creaste las tablas.
- **Escrituras atómicas**: DynamoDB garantiza que no habrá doble reserva gracias a ConditionExpression.
- **Endpoint `/quote/nails`**: Sigue funcionando como antes (análisis de uñas con IA).

## 🔐 Configuración de Credenciales AWS

### Opción 1: Variables de entorno (recomendado para local)
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### Opción 2: Archivo .env
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

### Opción 3: AWS Credentials File
```bash
aws configure
```

### Opción 4: IAM Role (para producción en EC2/Lambda)
Si el código corre en AWS (EC2, Lambda, ECS), usa IAM roles en lugar de credenciales.

## 📞 Troubleshooting

**Error: "Missing required environment variables"**
- Verifica que `.env` existe y tiene todas las variables requeridas.

**Error: "ResourceNotFoundException"**
- Las tablas no existen. Ejecuta `npm run setup:tables` o crea las tablas manualmente.

**Error: "AccessDeniedException"**
- Verifica tus credenciales AWS y permisos de DynamoDB.

**Error: "ConditionalCheckFailedException" (409)**
- Normal: significa que el slot ya está reservado. Es el comportamiento esperado.

## 🚀 Despliegue

Para producción:
1. Usa CloudFormation para crear las tablas
2. Configura IAM roles en lugar de credenciales
3. Usa variables de entorno del sistema o secrets manager
4. Considera usar DynamoDB Global Tables para alta disponibilidad
