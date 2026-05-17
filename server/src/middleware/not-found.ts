import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route not found: ${request.method} ${request.path}`));
};
