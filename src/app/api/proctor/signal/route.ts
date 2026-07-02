import { NextResponse } from "next/server";

// Simple in-memory signaling store for WebRTC coordination (clears on server restart)
type RoomState = {
  code: string;
  studentEmail?: string;
  desktopSdp?: any;
  mobileSdp?: any;
  desktopCandidates: any[];
  mobileCandidates: any[];
};

const activeRooms = new Map<string, RoomState>();

type ProctorCommand = {
  studentEmail: string;
  command: "prompt_camera" | "force_camera" | "prompt_audio" | "force_audio";
  timestamp: number;
};

let activeCommands: ProctorCommand[] = [];

type ProctorChat = {
  studentEmail: string;
  message: string;
  timestamp: number;
};

let activeChats: ProctorChat[] = [];

type StudentFeed = {
  studentEmail: string;
  primaryFeed?: string;   // base64 jpeg
  secondaryFeed?: string; // base64 jpeg
  audioFeed?: string;     // base64 audio
  audioTimestamp?: number;
  timestamp: number;
};

let activeFeeds: StudentFeed[] = [];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action")?.trim();

  if (action === "get_feeds") {
    const now = Date.now();
    activeFeeds = activeFeeds.filter((feed) => now - feed.timestamp < 12000);
    return NextResponse.json({ feeds: activeFeeds });
  }

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

  if (action === "get_chats") {
    const studentEmail = searchParams.get("studentEmail")?.trim();
    if (!studentEmail) {
      return NextResponse.json({ error: "studentEmail is required." }, { status: 400 });
    }

    const now = Date.now();
    // Clean stale chats (> 30s)
    activeChats = activeChats.filter((c) => now - c.timestamp < 30000);

    const foundChats = activeChats.filter((c) => c.studentEmail === studentEmail);
    // Clear them so they aren't returned again
    activeChats = activeChats.filter((c) => c.studentEmail !== studentEmail);

    return NextResponse.json({ chats: foundChats.map((c) => c.message) });
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

  const { action, code, role, sdp, candidate, studentEmail, command, primaryFeed, secondaryFeed, audioFeed } = body;

  // 0. Upload live camera frames (from student page or mobile device)
  if (action === "upload_feed") {
    let email = studentEmail;
    if (!email && code) {
      const rm = activeRooms.get(code);
      if (rm && rm.studentEmail) {
        email = rm.studentEmail;
      }
    }
    if (!email) {
      return NextResponse.json({ error: "studentEmail or room code mapping is required." }, { status: 400 });
    }
    const now = Date.now();
    const index = activeFeeds.findIndex((f) => f.studentEmail === email);
    if (index !== -1) {
      const feed = activeFeeds[index];
      if (primaryFeed !== undefined) feed.primaryFeed = primaryFeed;
      if (secondaryFeed !== undefined) feed.secondaryFeed = secondaryFeed;
      if (audioFeed !== undefined) {
        feed.audioFeed = audioFeed;
        feed.audioTimestamp = now;
      }
      feed.timestamp = now;
    } else {
      activeFeeds.push({
        studentEmail: email,
        primaryFeed,
        secondaryFeed,
        audioFeed,
        audioTimestamp: audioFeed ? now : undefined,
        timestamp: now,
      });
    }
    return NextResponse.json({ ok: true });
  }

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

  // 1b. Send Chat Warning (Proctor to Student)
  if (action === "send_chat") {
    const { message } = body;
    if (!studentEmail || !message) {
      return NextResponse.json({ error: "studentEmail and message are required." }, { status: 400 });
    }
    activeChats.push({
      studentEmail,
      message,
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
    if (studentEmail) {
      room.studentEmail = studentEmail;
    }
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
