export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
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

export function unauthorized() {
  return new ApiError(401, "unauthorized", "Invalid internal bearer token.");
}
