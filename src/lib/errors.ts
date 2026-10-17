import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth-guard";

/**
 * Base class for application domain errors with explicit HTTP status codes.
 */
export class DomainError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "DOMAIN_ERROR") {
    super(message);
    this.name = "DomainError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Thrown when a requested resource (room, reservation, customer, invoice) does not exist.
 */
export class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

/**
 * Thrown on resource conflicts, uniqueness violations, or concurrent booking collisions.
 */
export class ConflictError extends DomainError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

/**
 * Thrown when a request violates domain business rules or invalid state transitions.
 */
export class BadRequestError extends DomainError {
  constructor(message = "Bad request") {
    super(message, 400, "BAD_REQUEST");
    this.name = "BadRequestError";
  }
}

/**
 * Thrown when an authenticated user lacks permission for the requested operation.
 */
export class ForbiddenError extends DomainError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

/**
 * Thrown when an unauthenticated caller attempts to access a protected resource.
 */
export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

/**
 * Standardized API error mapper for Next.js Route Handlers.
 * Maps AuthError, ZodError, and DomainError to appropriate HTTP responses.
 * Treats unexpected errors as internal server failures (500) without exposing stack traces.
 */
export function handleApiError(
  error: unknown,
  fallbackMessage = "An unexpected internal server error occurred"
): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.mustChangePassword ? { mustChangePassword: true } : {}),
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Safe logging of unexpected runtime exceptions
  console.error("Unhandled API exception:", error);
  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500 }
  );
}
