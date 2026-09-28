import { ZodError } from 'zod';
import { AppError } from './domain';

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request.', details: error.issues } },
      { status: 400 },
    );
  }
  console.error('Unhandled API error', error);
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'The analysis could not be completed.' } },
    { status: 500 },
  );
}
