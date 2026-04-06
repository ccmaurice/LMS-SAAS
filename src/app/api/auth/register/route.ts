import { NextResponse } from "next/server";
import {
  fieldValidationErrorResponse,
  invalidJsonResponse,
  messageErrorResponse,
} from "@/lib/api/api-json";
import { checkRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import {
  selfServeRegisterBodySchema,
  selfServeRegisterSchool,
} from "@/lib/auth/self-serve-registration";

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const limited = checkRateLimit(`auth-register:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return limited.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return invalidJsonResponse();
  }

  const parsed = selfServeRegisterBodySchema.safeParse(json);
  if (!parsed.success) {
    return fieldValidationErrorResponse(parsed.error);
  }

  const result = await selfServeRegisterSchool(parsed.data);
  if (!result.ok) {
    return messageErrorResponse(result.error, result.status);
  }

  return NextResponse.json({
    pendingApproval: true,
    organization: result.organization,
    message:
      "Your school is pending approval by a platform operator. You will be able to sign in after it is approved.",
  });
}
