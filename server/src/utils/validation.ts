import { AppError } from '../errors/app-error';

export function expectObjectBody(value: unknown, message = 'Request body must be an object.'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', message);
  }

  return value as Record<string, unknown>;
}

export function expectNonEmptyString(
  value: unknown,
  fieldName: string,
  options: {
    maxLength?: number;
    minLength?: number;
  } = {},
): string {
  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is required.`);
  }

  if (options.minLength !== undefined && normalized.length < options.minLength) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be at least ${options.minLength} characters long.`,
    );
  }

  if (options.maxLength !== undefined && normalized.length > options.maxLength) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be at most ${options.maxLength} characters long.`,
    );
  }

  return normalized;
}

export function expectIsoDate(value: unknown, fieldName: string): string {
  const normalized = expectNonEmptyString(value, fieldName, { minLength: 10, maxLength: 10 });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be in YYYY-MM-DD format.`);
  }

  const timestamp = Date.parse(`${normalized}T00:00:00Z`);

  if (Number.isNaN(timestamp)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is not a valid date.`);
  }

  return normalized;
}

export function expectPositiveInteger(
  value: unknown,
  fieldName: string,
  options: {
    max?: number;
    min?: number;
  } = {},
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be an integer.`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be at least ${options.min}.`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be at most ${options.max}.`);
  }

  return value;
}

export function expectBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a boolean.`);
  }

  return value;
}

export function expectEnum<TValue extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly TValue[],
): TValue {
  if (typeof value !== 'string' || !allowedValues.includes(value as TValue)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    );
  }

  return value as TValue;
}

export function normalizeOptionalString(
  value: unknown,
  fieldName: string,
  options: {
    maxLength?: number;
  } = {},
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (options.maxLength !== undefined && normalized.length > options.maxLength) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be at most ${options.maxLength} characters long.`,
    );
  }

  return normalized;
}
