import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { Role } from "@/generated/prisma/enums";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null as null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null as null };
}

export function requireRoles(user: { role: Role }, roles: Role[]) {
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
