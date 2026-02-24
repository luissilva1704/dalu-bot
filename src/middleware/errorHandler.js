/**
 * Centralized error handling middleware
 */
export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // DynamoDB ConditionalCheckFailedException (double booking)
  if (err.code === 'CONFLICT' || err.statusCode === 409) {
    return res.status(409).json({
      error: 'Conflict',
      message: err.message || 'This slot is already booked',
    });
  }

  // AWS SDK errors
  if (err.name === 'ConditionalCheckFailedException') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'This slot is already booked',
    });
  }

  // ResourceNotFoundException
  if (err.name === 'ResourceNotFoundException') {
    return res.status(404).json({
      error: 'Not found',
      message: 'Resource not found',
    });
  }

  // Default error response
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: status === 500 ? 'Internal server error' : message,
    ...(process.env.NODE_ENV === 'development' && { details: err.stack }),
  });
}
