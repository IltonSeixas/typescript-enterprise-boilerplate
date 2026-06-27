import type { ZodSchema } from 'zod';
import { GrpcError } from './grpc-error.mapper.js';
import { status } from '@grpc/grpc-js';

export function parseRequest<T>(schema: ZodSchema<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new GrpcError(status.INVALID_ARGUMENT, message);
  }
  return parsed.data;
}
