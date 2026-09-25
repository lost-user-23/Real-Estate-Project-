class AppError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode;
    if (details) {
      this.details = details;
    }
  }

  static badRequest(message, details) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message) {
    return new AppError(message || 'Not authenticated', 401);
  }

  static forbidden(message) {
    return new AppError(message || 'Forbidden', 403);
  }

  static notFound(message) {
    return new AppError(message || 'Not found', 404);
  }

  static conflict(message) {
    return new AppError(message || 'Conflict', 409);
  }
}

module.exports = AppError;
