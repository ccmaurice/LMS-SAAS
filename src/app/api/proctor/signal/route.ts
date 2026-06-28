import { NextResponse } from "next/server";

// Simple in-memory signaling store for WebRTC coordination (clears on server restart)
type RoomState = {
  code: string;
  desktopSdp?: any;
  mobileSdp?: any;
  desktopCandidates: any[];
  mobileCandidates: any[];
};

const activeRooms = new Map<string, RoomState>();

type ProctorCommand = {
  studentEmail: string;
  command: "prompt_camera" | "force_camera";
  timestamp: number;
};

let activeCommands: ProctorCommand[] = [];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action")?.trim();

  if (action === "get_command") {
    const studentEmail = searchParams.get("studentEmail")?.trim();
    if (!studentEmail) {
      return NextResponse.json({ error: "studentEmail is required." }, { status: 400 });
    }

    const now = Date.now();
    // Clean stale commands
    activeCommands = activeCommands.filter((cmd) => now - cmd.timestamp < 15000);

    const index = activeCommands.findIndex((cmd) => cmd.studentEmail === studentEmail);
    if (index !== -1) {
      const foundCmd = activeCommands[index];
      activeCommands.splice(index, 1);
      return NextResponse.json({ command: foundCmd.command });
    }
    return NextResponse.json({ command: null });
  }

  const code = searchParams.get("code")?.trim();
  const role = searchParams.get("role")?.trim(); // "desktop" | "mobile"

  if (!code || !role) {
    return NextResponse.json({ error: "Code and role are required." }, { status: 400 });
  }

  const room = activeRooms.get(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // If role is desktop, return mobile's sdp and candidates
  if (role === "desktop") {
    return NextResponse.json({
      sdp: room.mobileSdp ?? null,
      candidates: room.mobileCandidates,
    });
  }

  // If role is mobile, return desktop's sdp and candidates
  if (role === "mobile") {
    return NextResponse.json({
      sdp: room.desktopSdp ?? null,
      candidates: room.desktopCandidates,
    });
  }

  return NextResponse.json({ error: "Invalid role." }, { status: 400 });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, code, role, sdp, candidate, studentEmail, command } = body;

  // 1. Send Command (Proctor to Student)
  if (action === "send_command") {
    if (!studentEmail || !command) {
      return NextResponse.json({ error: "studentEmail and command are required." }, { status: 400 });
    }
    activeCommands.push({
      studentEmail,
      command,
      timestamp: Date.now(),
    });
    return NextResponse.json({ ok: true });
  }

  // 2. Create a new room code
  if (action === "create") {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    activeRooms.set(newCode, {
      code: newCode,
      desktopCandidates: [],
      mobileCandidates: [],
    });
    return NextResponse.json({ ok: true, code: newCode });
  }

  // Ensure code exists for other actions
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const room = activeRooms.get(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found or expired." }, { status: 404 });
  }

  // 3. Validate/join room
  if (action === "join") {
    return NextResponse.json({ ok: true });
  }

  // 4. Send SDP offer / answer
  if (action === "sdp") {
    if (!role || !sdp) {
      return NextResponse.json({ error: "Role and sdp are required." }, { status: 400 });
    }
    if (role === "desktop") {
      room.desktopSdp = sdp;
    } else if (role === "mobile") {
      room.mobileSdp = sdp;
    }
    return NextResponse.json({ ok: true });
  }

  // 5. Send ICE candidates
  if (action === "candidate") {
    if (!role || !candidate) {
      return NextResponse.json({ error: "Role and candidate are required." }, { status: 400 });
    }
    if (role === "desktop") {
      room.desktopCandidates.push(candidate);
    } else if (role === "mobile") {
      room.mobileCandidates.push(candidate);
    }
    return NextResponse.json({ ok: true });
  }

  // 6. Clean up/close room
  if (action === "close") {
    activeRooms.delete(code);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
