import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Validate required environment variables
const requiredEnvVars = ['AWS_REGION', 'DYNAMO_TABLE_SCHEDULES', 'DYNAMO_TABLE_BOOKINGS'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
    'Please set them in your .env file or environment.'
  );
}

// Create DynamoDB client
//const client = new DynamoDBClient({
//  region: process.env.AWS_REGION || 'us-east-1',
//  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
//    ? {
//        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//      }
//    : undefined, // Will use default credential provider chain (IAM role, etc.)
//});

// Create DocumentClient for easier data handling
//export const docClient = DynamoDBDocumentClient.from(client, {
//  marshallOptions: {
//    removeUndefinedValues: true,
//    convertEmptyValues: false,
//  },
//  unmarshallOptions: {
//    wrapNumbers: false,
//  },
//});
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const client = new DynamoDBClient({ region });

// DocumentClient
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Export table names
export const TABLES = {
  SCHEDULES: process.env.DYNAMO_TABLE_SCHEDULES || 'dalu-schedules',
  BOOKINGS: process.env.DYNAMO_TABLE_BOOKINGS || 'dalu-bookings',
  CAPACITY: process.env.DYNAMO_TABLE_CAPACITY || 'dalu-capacity',
};

export default docClient;
