#!/bin/bash
# Recrea la tabla dalu-schedules con el esquema nuevo (pk + sk)
# Ejecutar: ./scripts/recreate-schedules-table.sh

set -e
REGION="${AWS_REGION:-us-east-1}"
TABLE="${DYNAMO_TABLE_SCHEDULES:-dalu-schedules}"

echo "⚠️  Esto eliminará la tabla $TABLE y todos sus datos."
echo "¿Continuar? (escribe 'yes' para confirmar)"
read -r confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelado."
  exit 0
fi

echo "Eliminando tabla $TABLE..."
aws dynamodb delete-table --table-name "$TABLE" --region "$REGION" 2>/dev/null || true

echo "Esperando eliminación..."
sleep 5

echo "Creando tabla $TABLE con pk + sk..."
aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

echo "✅ Tabla recreada. Verifica con:"
echo "   aws dynamodb describe-table --table-name $TABLE --region $REGION"
