#!/usr/bin/env node

/**
 * Script to create DynamoDB tables using AWS CLI
 * Run: node scripts/setup-dynamodb-tables.js
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables
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
  } catch (error) {
    console.warn('Warning: .env file not found, using environment variables');
    return {};
  }
}

const env = { ...process.env, ...loadEnv() };

const AWS_REGION = env.AWS_REGION || 'us-east-1';
const SCHEDULES_TABLE = env.DYNAMO_TABLE_SCHEDULES || 'dalu-schedules';
const BOOKINGS_TABLE = env.DYNAMO_TABLE_BOOKINGS || 'dalu-bookings';
const CAPACITY_TABLE = env.DYNAMO_TABLE_CAPACITY || 'dalu-capacity';

console.log('🚀 Creating DynamoDB tables...');
console.log(`Region: ${AWS_REGION}`);
console.log(`Schedules Table: ${SCHEDULES_TABLE}`);
console.log(`Bookings Table: ${BOOKINGS_TABLE}`);
console.log(`Capacity Table: ${CAPACITY_TABLE}\n`);

// Create Schedules table (pk = W#year#week#D#day, sk = T#technicianId)
console.log('Creating Schedules table...');
try {
  execSync(
    `aws dynamodb create-table \
      --table-name ${SCHEDULES_TABLE} \
      --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
      --billing-mode PAY_PER_REQUEST \
      --region ${AWS_REGION}`,
    { stdio: 'inherit' }
  );
  console.log(`✅ Table ${SCHEDULES_TABLE} created successfully\n`);
} catch (error) {
  if (error.message.includes('ResourceInUseException')) {
    console.log(`⚠️  Table ${SCHEDULES_TABLE} already exists\n`);
  } else {
    console.error(`❌ Error creating ${SCHEDULES_TABLE}:`, error.message);
    process.exit(1);
  }
}

// Create Bookings table (with GSI byBookingId)
console.log('Creating Bookings table...');
try {
  execSync(
    `aws dynamodb create-table \
      --table-name ${BOOKINGS_TABLE} \
      --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S AttributeName=bookingId,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
      --global-secondary-indexes '[
        {
          "IndexName": "byBookingId",
          "KeySchema": [{"AttributeName":"bookingId","KeyType":"HASH"}],
          "Projection": {"ProjectionType":"ALL"}
        }
      ]' \
      --billing-mode PAY_PER_REQUEST \
      --region ${AWS_REGION}`,
    { stdio: 'inherit' }
  );
  console.log(`✅ Table ${BOOKINGS_TABLE} created successfully\n`);
} catch (error) {
  if (error.message.includes('ResourceInUseException')) {
    console.log(`⚠️  Table ${BOOKINGS_TABLE} already exists\n`);
  } else {
    console.error(`❌ Error creating ${BOOKINGS_TABLE}:`, error.message);
    process.exit(1);
  }
}

// Create Capacity table (pk = Y#year#W#week#D#day, sk = S#slot)
console.log('Creating Capacity table...');
try {
  execSync(
    `aws dynamodb create-table \
      --table-name ${CAPACITY_TABLE} \
      --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
      --billing-mode PAY_PER_REQUEST \
      --region ${AWS_REGION}`,
    { stdio: 'inherit' }
  );
  console.log(`✅ Table ${CAPACITY_TABLE} created successfully\n`);
} catch (error) {
  if (error.message.includes('ResourceInUseException')) {
    console.log(`⚠️  Table ${CAPACITY_TABLE} already exists\n`);
  } else {
    console.error(`❌ Error creating ${CAPACITY_TABLE}:`, error.message);
    process.exit(1);
  }
}

console.log('✨ All tables created successfully!');
console.log('\nNext steps:');
console.log('1. Set environment variables in .env file');
console.log('2. Run: npm run dev');
