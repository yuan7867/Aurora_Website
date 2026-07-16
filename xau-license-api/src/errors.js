export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message || code);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function badRequest(code, message) {
  return new ApiError(400, code, message);
}

export function conflict(code, message) {
  return new ApiError(409, code, message);
}
