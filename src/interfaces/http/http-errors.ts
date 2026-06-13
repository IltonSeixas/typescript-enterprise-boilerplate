import type { ZodError } from 'zod';

export function formatZodError(err: ZodError): object {
  return {
    statusCode: 400,
    error: 'Bad Request',
    message: 'Validation failed',
    details: err.issues.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  };
}

export function domainError(err: { code: string; message: string }): object {
  return {
    statusCode: undefined,
    error: err.code,
    message: err.message,
  };
}
