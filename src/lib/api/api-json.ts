import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/** 400 when the body is not valid JSON. */
export function invalidJsonResponse() {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}

/** 400 when Zod validation failed; `error` is field → messages (form-friendly). */
export function fieldValidationErrorResponse(zodError: ZodError) {
  return NextResponse.json({ error: zodError.flatten().fieldErrors }, { status: 400 });
}

/** JSON error with a single message string (auth, conflicts, domain errors). */
export function messageErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
