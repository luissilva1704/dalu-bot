#!/usr/bin/env node

/**
 * Adds the byTechnician GSI to an existing dalu-bookings table.
 * Required for efficient lookup of CONFIRMED bookings by technician+day.
 * Run: node scripts/add-booking-technician-gsi.js
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function loadEnv() {
  try {
    const envFile = readFileSync(join(projectRoot, '.env'), 'utf8');
    const env = {};
    envFile.split('\n').forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    });
    return env;
  } catch {
    return {};
  }
}

const env = { ...process.env, ...loadEnv() };
const AWS_REGION = env.AWS_REGION || 'us-east-1';
const BOOKINGS_TABLE = env.DYNAMO_TABLE_BOOKINGS || 'dalu-bookings';

console.log(`Adding GSI byTechnician to table ${BOOKINGS_TABLE} in ${AWS_REGION}...`);

try {
  execSync(
    `aws dynamodb update-table \
      --table-name ${BOOKINGS_TABLE} \
      --attribute-definitions AttributeName=gsi1pk,AttributeType=S AttributeName=gsi1sk,AttributeType=S \
      --global-secondary-index-updates '[
        {
          "Create": {
            "IndexName": "byTechnician",
            "KeySchema": [
              {"AttributeName":"gsi1pk","KeyType":"HASH"},
              {"AttributeName":"gsi1sk","KeyType":"RANGE"}
            ],
            "Projection": {"ProjectionType":"ALL"}
          }
        }
      ]' \
      --region ${AWS_REGION}`,
    { stdio: 'inherit' }
  );
  console.log('✅ GSI byTechnician added. It may take a few minutes to become ACTIVE.');
} catch (error) {
  if (error.message.includes('LimitExceededException')) {
    console.error('❌ Cannot add more than one GSI at a time. Wait for any in-progress index to finish.');
  } else if (error.message.includes('ResourceInUseException')) {
    console.error('❌ Table is being updated. Wait and try again.');
  } else {
    console.error('❌ Error:', error.message);
  }
  process.exit(1);
}
