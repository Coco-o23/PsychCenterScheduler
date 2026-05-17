import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error';

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const normalizedError =
    error instanceof AppError
      ? error
      : new AppError(500, 'INTERNAL_SERVER_ERROR', 'Unexpected server error.');

  const body: ErrorResponseBody = {
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
    },
  };

  if (normalizedError.details !== undefined) {
    body.error.details = normalizedError.details;
  }

  response.status(normalizedError.statusCode).json(body);
};
