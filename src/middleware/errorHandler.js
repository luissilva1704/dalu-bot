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
      message: err.message || 'Resource not found',
      details: err.message,
    });
  }

  // AccessDeniedException, etc.
  if (err.name === 'AccessDeniedException' || err.code === 'AccessDeniedException') {
    return res.status(403).json({
      error: 'Access denied',
      message: err.message || 'Cannot access DynamoDB table',
      details: err.message,
    });
  }

  // Default error response (AWS SDK v3 uses err.$metadata?.httpStatusCode)
  const status = err.status ?? err.statusCode ?? err.$metadata?.httpStatusCode ?? 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: status === 500 ? 'Internal server error' : message,
    details: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
