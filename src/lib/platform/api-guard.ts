import { NextResponse } from "next/server";
import { getPlatformOperator, type PlatformOperator } from "@/lib/platform/session";

export async function requirePlatformOperator(): Promise<
  { op: PlatformOperator; response: null } | { op: null; response: NextResponse }
> {
  const op = await getPlatformOperator();
  if (!op) {
    return { op: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { op, response: null };
}
