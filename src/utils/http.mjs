export const json = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(data),
  });
  
  export const badRequest = (message, extra = {}) =>
    json(400, { error: message, ...extra });
  
  export const serverError = (message, extra = {}) =>
    json(500, { error: message, ...extra });
  