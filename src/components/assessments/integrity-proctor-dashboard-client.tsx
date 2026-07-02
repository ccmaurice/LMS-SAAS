"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Shield,
  Sparkles,
  MessageSquare,
  Maximize2,
  Monitor,
  Camera,
  Video,
  VideoOff,
  LayoutGrid,
  Activity,
  Download,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Settings,
  Users,
  Bell,
  Clock,
  HardDrive,
  Trash2,
  ListFilter,
  CheckCircle2,
  Sliders,
  PhoneOff
} from "lucide-react";

type ProctorEvent = {
  id: string;
  eventType: string;
  createdAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  user: { name: string | null; email: string };
  dismissedAt: Date | null;
};

export function IntegrityProctorDashboardClient({
  initialEvents,
  _assessmentTitle,
  _assessmentId,
  _userRole,
}: {
  initialEvents: ProctorEvent[];
  _assessmentTitle: string;
  _assessmentId: string;
  _userRole?: string;
}) {
  const [events, setEvents] = useState<ProctorEvent[]>(initialEvents);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(
    initialEvents[0]?.user.email || null
  );
  const [zoomedStudent, setZoomedStudent] = useState<string | null>(null);
  
  // Navigation tabs: live, history, alerts, reports, settings
  const [activeTab, setActiveTab] = useState<"live" | "history" | "alerts" | "reports" | "settings">("live");

  // Timer states
  const [timeLeft, setTimeLeft] = useState(5055); // 01:24:15
  const [gmtClock, setGmtClock] = useState("");

  // Live stream invigilation states
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [monitoringActive, setMonitoringActive] = useState(true);
  const [liveFeeds, setLiveFeeds] = useState<
    Record<string, { primaryFeed?: string; secondaryFeed?: string; audioFeed?: string; audioTimestamp?: number }>
  >({});
  const [recordingStates, setRecordingStates] = useState<
    Record<string, { active: boolean; remaining: number }>
  >({});

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Real-time chat messages
  const [proctorChats, setProctorChats] = useState<{ id: string; msg: string; time: string }[]>([]);

  // Audio listening and recording states
  const [listeningTo, setListeningTo] = useState<Record<string, boolean>>({});
  const [audioRecordingStates, setAudioRecordingStates] = useState<Record<string, { active: boolean; duration: number }>>({});
  const audioChunksRef = useRef<Record<string, string[]>>({});
  const lastPlayedAudioTimestamps = useRef<Record<string, number>>({});

  const PRESET_WARNINGS = [
    "Please look directly at the screen.",
    "Webcam must show your full face clearly.",
    "Multiple people detected. Ensure you are alone.",
    "Audio spike detected. Please keep the environment quiet.",
  ];

  // 1. Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTimeLeft = useMemo(() => {
    const hrs = Math.floor(timeLeft / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);
    const secs = timeLeft % 60;
    return [
      hrs.toString().padStart(2, "0"),
      mins.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0"),
    ].join(":");
  }, [timeLeft]);

  // 2. GMT Clock ticking effect
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hrs = now.getUTCHours().toString().padStart(2, "0");
      const mins = now.getUTCMinutes().toString().padStart(2, "0");
      const secs = now.getUTCSeconds().toString().padStart(2, "0");
      setGmtClock(`${hrs}:${mins}:${secs} GMT`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute final student list: REAL database students ONLY! No mock accounts.
  const studentsList = useMemo(() => {
    const dbList = new Map<string, { name: string | null; email: string }>();
    events.forEach((e) => {
      dbList.set(e.user.email, e.user);
    });
    return Array.from(dbList.values());
  }, [events]);

  // Select first student if none selected
  useEffect(() => {
    if (!selectedStudent && studentsList.length > 0) {
      setSelectedStudent(studentsList[0].email);
    }
  }, [studentsList, selectedStudent]);

  // Selected student's events
  const studentEvents = useMemo(() => {
    if (!selectedStudent) return [];
    return events
      .filter((e) => e.user.email === selectedStudent)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [selectedStudent, events]);

  // Start live monitoring (requests webcam)
  const startLiveMonitoring = async () => {
    try {
      const constraintsQueue = [
        { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let lastError: unknown = null;
      for (const constraints of constraintsQueue) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!stream) {
        throw lastError;
      }
      setLiveStream(stream);
      setMonitoringActive(true);

      // Attach stream to all active student video nodes
      studentsList.forEach((stud) => {
        const el = videoRefs.current[stud.email];
        if (el) el.srcObject = stream;
      });
    } catch (err) {
      console.error("Failed to request webcam for invigilation grid:", err);
    }
  };

  // Stop live monitoring
  const stopLiveMonitoring = useCallback(() => {
    if (liveStream) {
      liveStream.getTracks().forEach((track) => track.stop());
      setLiveStream(null);
    }
    setMonitoringActive(false);
  }, [liveStream]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (liveStream) {
        liveStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [liveStream]);

  // Poll signaling server for actual student camera feeds
  useEffect(() => {
    if (!monitoringActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/proctor/signal?action=get_feeds");
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, { primaryFeed?: string; secondaryFeed?: string; audioFeed?: string; audioTimestamp?: number }> = {};
          if (data.feeds) {
            for (const f of data.feeds) {
              map[f.studentEmail] = {
                primaryFeed: f.primaryFeed,
                secondaryFeed: f.secondaryFeed,
                audioFeed: f.audioFeed,
                audioTimestamp: f.audioTimestamp,
              };

              // Process audio playback & recording chunks
              if (f.audioFeed && f.audioTimestamp) {
                const lastPlayed = lastPlayedAudioTimestamps.current[f.studentEmail] || 0;
                const chunkTimestamp = f.audioTimestamp;

                if (chunkTimestamp > lastPlayed) {
                  lastPlayedAudioTimestamps.current[f.studentEmail] = chunkTimestamp;

                  // Play if listening is enabled
                  if (listeningTo[f.studentEmail]) {
                    const audioUri = `data:audio/webm;base64,${f.audioFeed}`;
                    const audio = new Audio(audioUri);
                    audio.play().catch((err) => {
                      console.warn("Failed to play student audio chunk:", err);
                    });
                  }

                  // Accumulate chunk if recording is active
                  if (audioRecordingStates[f.studentEmail]?.active) {
                    if (!audioChunksRef.current[f.studentEmail]) {
                      audioChunksRef.current[f.studentEmail] = [];
                    }
                    audioChunksRef.current[f.studentEmail].push(f.audioFeed);
                  }
                }
              }
            }
          }
          setLiveFeeds(map);
        }
      } catch (err) {
        console.error("Error fetching live student feeds:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [monitoringActive, listeningTo, audioRecordingStates]);

  // Audio duration counter increment effect
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioRecordingStates((prev) => {
        const updated = { ...prev };
        let changed = false;
        for (const email in updated) {
          if (updated[email]?.active) {
            updated[email] = {
              ...updated[email],
              duration: updated[email].duration + 1,
            };
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleListening = (studentEmail: string) => {
    setListeningTo((prev) => ({
      ...prev,
      [studentEmail]: !prev[studentEmail],
    }));
  };

  const toggleAudioRecording = (studentEmail: string) => {
    const isRecording = audioRecordingStates[studentEmail]?.active;
    if (!isRecording) {
      audioChunksRef.current[studentEmail] = [];
      setAudioRecordingStates((prev) => ({
        ...prev,
        [studentEmail]: { active: true, duration: 0 },
      }));
    } else {
      setAudioRecordingStates((prev) => ({
        ...prev,
        [studentEmail]: { active: false, duration: 0 },
      }));
      downloadAudioRecording(studentEmail);
    }
  };

  const downloadAudioRecording = (studentEmail: string) => {
    const chunks = audioChunksRef.current[studentEmail];
    if (!chunks || chunks.length === 0) return;

    try {
      const byteArrays = chunks.map((base64) => {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      });

      const totalLength = byteArrays.reduce((acc, arr) => acc + arr.length, 0);
      const mergedArray = new Uint8Array(totalLength);
      let offset = 0;
      for (const arr of byteArrays) {
        mergedArray.set(arr, offset);
        offset += arr.length;
      }

      const blob = new Blob([mergedArray], { type: "audio/webm" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `evidence_audio_${studentEmail.replace(/[@.]/g, "_")}.webm`;
      link.click();

      // Log incident
      const now = new Date();
      const newEv: ProctorEvent = {
        id: Math.random().toString(),
        eventType: "evidence_audio",
        createdAt: now,
        dismissedAt: null,
        user: studentsList.find((s) => s.email === studentEmail) || {
          name: studentEmail,
          email: studentEmail,
        },
        payload: {
          description: `Invigilator manually recorded a ${Math.round(totalLength / 16000)}s audio clip as evidence`,
          severity: "red",
        },
      };
      setEvents((prev) => [newEv, ...prev]);
    } catch (err) {
      console.error("Failed to compile or download audio recording:", err);
    }
  };

  // Log snapshot captures in candidate's incident logs
  const logSnapshotIncident = (studentEmail: string, dataUrl?: string) => {
    const now = new Date();
    const newEv: ProctorEvent = {
      id: Math.random().toString(),
      eventType: "evidence_snapshot",
      createdAt: now,
      dismissedAt: null,
      user: studentsList.find((s) => s.email === studentEmail) || {
        name: studentEmail,
        email: studentEmail,
      },
      payload: {
        description: "Invigilator manually captured a photo snapshot as evidence",
        severity: "red",
        screenshotUrl: dataUrl,
      },
    };
    setEvents((prev) => [newEv, ...prev]);
  };

  // Capture Snapshot as Evidence
  const takeSnapshot = (studentEmail: string) => {
    const feed = liveFeeds[studentEmail];
    if (feed?.primaryFeed && feed.primaryFeed !== "disabled") {
      const link = document.createElement("a");
      link.href = feed.primaryFeed;
      link.download = `evidence_snapshot_${studentEmail.replace(/[@.]/g, "_")}.jpg`;
      link.click();
      logSnapshotIncident(studentEmail, feed.primaryFeed);
      return;
    }

    const videoEl = videoRefs.current[studentEmail];
    if (!videoEl) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `evidence_snapshot_${studentEmail.replace(/[@.]/g, "_")}.jpg`;
      link.click();

      logSnapshotIncident(studentEmail, dataUrl);
    }
  };

  // Record 5s Clip as Evidence
  const recordClip = (studentEmail: string) => {
    if (!liveStream) return;

    setRecordingStates((prev) => ({ ...prev, [studentEmail]: { active: true, remaining: 5 } }));

    const mediaRecorder = new MediaRecorder(liveStream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `evidence_clip_${studentEmail.replace(/[@.]/g, "_")}.webm`;
      link.click();

      setRecordingStates((prev) => ({ ...prev, [studentEmail]: { active: false, remaining: 0 } }));

      const now = new Date();
      const newEv: ProctorEvent = {
        id: Math.random().toString(),
        eventType: "evidence_clip",
        createdAt: now,
        dismissedAt: null,
        user: studentsList.find((s) => s.email === studentEmail) || {
          name: studentEmail,
          email: studentEmail,
        },
        payload: {
          description: "Invigilator recorded a 5-second video clip as evidence",
          severity: "red",
        },
      };
      setEvents((prev) => [newEv, ...prev]);
    };

    mediaRecorder.start();

    let count = 5;
    const interval = setInterval(() => {
      count--;
      setRecordingStates((prev) => ({ ...prev, [studentEmail]: { active: true, remaining: count } }));
      if (count <= 0) {
        clearInterval(interval);
        mediaRecorder.stop();
      }
    }, 1000);
  };

  // Dispatch prompt alerts to candidates (real API endpoints)
  const sendProctorCommand = async (
    studentEmail: string,
    command: "prompt_camera" | "force_camera" | "prompt_audio" | "force_audio"
  ) => {
    try {
      const res = await fetch("/api/proctor/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_command",
          studentEmail,
          command,
        }),
      });
      if (res.ok) {
        const now = new Date();
        let eventType = "proctor_prompt_camera";
        let description = "";
        if (command === "prompt_camera") {
          eventType = "proctor_prompt_camera";
          description = "Sent prompt to student to turn on camera";
        } else if (command === "force_camera") {
          eventType = "proctor_force_camera";
          description = "Forced camera activation request on student screen";
        } else if (command === "prompt_audio") {
          eventType = "proctor_prompt_audio";
          description = "Sent prompt to student to turn on microphone/audio";
        } else if (command === "force_audio") {
          eventType = "proctor_force_audio";
          description = "Forced microphone/audio activation request on student screen";
        }

        const newEv: ProctorEvent = {
          id: Math.random().toString(),
          eventType,
          createdAt: now,
          dismissedAt: null,
          user: studentsList.find((s) => s.email === studentEmail) || {
            name: studentEmail,
            email: studentEmail,
          },
          payload: {
            description,
            severity: "yellow",
          },
        };
        setEvents((prev) => [newEv, ...prev]);
      }
    } catch (err) {
      console.error("Failed to dispatch proctor command:", err);
    }
  };

  // Chat Intervention message transmission to API
  const sendIntervention = async (msg: string) => {
    if (!selectedStudent) return;
    const now = new Date();
    setProctorChats((prev) => [
      ...prev,
      { id: Math.random().toString(), msg, time: now.toLocaleTimeString() },
    ]);

    try {
      // POST chat message to signaling server
      await fetch("/api/proctor/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_chat",
          studentEmail: selectedStudent,
          message: msg,
        }),
      });

      // Log intervention alert event
      const matchedEvent = events.find((e) => e.user.email === selectedStudent);
      const newEv: ProctorEvent = {
        id: Math.random().toString(),
        eventType: "proctor_warning",
        createdAt: now,
        dismissedAt: null,
        user: matchedEvent?.user || { name: selectedStudent, email: selectedStudent },
        payload: {
          description: `Proctor warning sent: "${msg}"`,
          severity: "yellow",
        },
      };
      setEvents((prev) => [newEv, ...prev]);
    } catch (err) {
      console.error("Failed to transmit chat warning to server:", err);
    }
  };

  // Delete event from DB and state (restricted to Admins only)
  const deleteEvent = async (eventId: string) => {
    if (_userRole !== "ADMIN") {
      alert("Permission Denied: Only Admins can delete integrity logs.");
      return;
    }
    if (!confirm("Are you sure you want to delete this integrity log? This action is permanent.")) return;

    try {
      const res = await fetch(`/api/assessments/${_assessmentId}/proctoring/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete log");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred deleting event");
    }
  };

  // Excuse / Dismiss event (available to teachers and admins)
  const excuseEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/assessments/${_assessmentId}/proctoring/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [eventId] }),
      });
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, dismissedAt: new Date() } : e))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Risk calculation based on event history
  const riskAnalysis = useMemo(() => {
    if (studentEvents.length === 0)
      return {
        score: 0,
        rating: "Safe",
        color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      };

    let redCount = 0;
    let yellowCount = 0;

    studentEvents.forEach((e) => {
      const severity = e.payload?.severity || "";
      if (severity === "red" || e.eventType === "tab_switch_paused") redCount++;
      else if (severity === "yellow") yellowCount++;
    });

    const score = Math.min(100, redCount * 35 + yellowCount * 15);

    if (score >= 70) {
      return { score, rating: "Suspicious", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" };
    }
    if (score >= 30) {
      return { score, rating: "Warning", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    }
    return {
      score,
      rating: "Safe",
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    };
  }, [studentEvents]);

  // Active unexcused alerts count
  const activeAlertsCount = useMemo(() => {
    return events.filter((e) => e.dismissedAt === null).length;
  }, [events]);

  const isAdmin = _userRole === "ADMIN";

  return (
    <div className="relative min-h-[640px] flex bg-[#111215] text-white overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
      
      {/* Left Mini-Sidebar Application Navigation */}
      <aside className="w-48 bg-[#141519] border-r border-zinc-800/80 flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          {/* Logo Brand Header */}
          <div className="p-4 border-b border-zinc-800/80 flex items-center gap-2">
            <div className="size-8 rounded-lg bg-red-650/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <Shield className="size-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-xs tracking-wider text-white">Integrity Pro</h2>
              <span className="text-[8px] text-muted-foreground font-semibold">SECURITY CORE</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab("live")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "live"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("live")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all"
            >
              <Activity className="w-3.5 h-3.5" />
              Exam Session
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "history"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Candidates
            </button>
            <button
              onClick={() => setActiveTab("alerts")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "alerts"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Alerts
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "reports"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              )}
            >
              <Monitor className="w-3.5 h-3.5" />
              Reports
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === "settings"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </nav>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/80">
          <div className="flex items-center gap-2 px-2 py-1 bg-zinc-800/40 rounded border border-zinc-800 text-[10px]">
            <Clock className="w-3 h-3 text-red-500" />
            <span className="font-semibold truncate">Active Roster</span>
          </div>
        </div>
      </aside>

      {/* Main Right Workspace Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#16171a]">
        
        {/* Top Control Panel Header Bar */}
        <header className="px-6 py-3.5 bg-[#1a1b20] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-red-500" />
            <span className="font-extrabold text-sm tracking-wider uppercase">Integrity Pro</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            {/* Exam selector display */}
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center gap-2 text-white">
              <span className="font-bold text-[11px]">Exam:</span>
              <span className="text-zinc-300 truncate max-w-[150px]">{_assessmentTitle || "BIOLOGY 101"}</span>
            </div>

            {/* Candidates selector display */}
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center gap-2 text-white">
              <span className="font-bold text-[11px]">Candidates:</span>
              <span className="text-emerald-400 font-bold">{studentsList.length} Active</span>
            </div>

            {/* Countdown timer ticking */}
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center gap-2 text-white font-mono">
              <span className="text-zinc-400 font-sans font-bold text-[11px]">Time Remaining:</span>
              <span className="text-white font-bold">{formattedTimeLeft}</span>
            </div>

            {/* Active alerts display */}
            <div className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 flex items-center gap-1.5 text-red-400 font-bold">
              <Bell className="w-3.5 h-3.5 text-red-400" />
              <span>Alerts ({activeAlertsCount})</span>
            </div>

            <div className="hidden xl:block text-zinc-400 font-mono text-[11px] font-semibold border-l border-zinc-800 pl-4">
              {gmtClock}
            </div>
          </div>
        </header>

        {/* Outer Dashboard Scrollable Content */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Live Tab View */}
          {activeTab === "live" && (
            <div className="space-y-5">
              
              {/* Critical Hardware Offline Alerts Banner */}
              {studentsList.some(s => liveFeeds[s.email]?.primaryFeed === "disabled" || liveFeeds[s.email]?.audioFeed === "disabled") && (
                <div className="bg-red-950/40 border-2 border-red-650 text-red-200 p-4 rounded-xl space-y-2 animate-pulse shadow-lg">
                  <div className="flex items-center gap-2.5 font-bold text-sm">
                    <AlertCircle className="w-5 h-5 text-red-500 animate-bounce" />
                    <span>CRITICAL SECURITY FEED OFFLINE ALERT</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs space-y-1 font-semibold">
                    {studentsList.map(s => {
                      const feed = liveFeeds[s.email];
                      const camOff = feed?.primaryFeed === "disabled";
                      const micOff = feed?.audioFeed === "disabled";
                      if (camOff || micOff) {
                        return (
                          <li key={s.email} className="text-red-300">
                            <strong>{s.name || s.email}</strong>: {camOff && "Webcam Turned Off"} {camOff && micOff && " & "} {micOff && "Microphone Muted"}. Please prompt or force reactivation.
                          </li>
                        );
                      }
                      return null;
                    })}
                  </ul>
                </div>
              )}

              {/* Header Title & On/Off Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white uppercase">EXAM INTEGRITY PRO: LIVE MONITORING</h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Multi-candidate grid invigilation. Click action commands below any camera box to alert students in real time.
                  </p>
                </div>
                <div>
                  {!monitoringActive ? (
                    <Button
                      onClick={startLiveMonitoring}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs font-semibold shadow-md shadow-emerald-950/20"
                    >
                      <Video className="w-4 h-4" />
                      Start Live Feeds
                    </Button>
                  ) : (
                    <Button
                      onClick={stopLiveMonitoring}
                      variant="destructive"
                      className="flex items-center gap-1.5 text-xs font-semibold shadow-md"
                    >
                      <VideoOff className="w-4 h-4" />
                      Stop Live Feeds
                    </Button>
                  )}
                </div>
              </div>

              {/* Candidates Grid layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {studentsList.map((stud) => {
                  const recState = recordingStates[stud.email];
                  const isRecording = recState?.active;
                  const feed = liveFeeds[stud.email];
                  const camOff = feed?.primaryFeed === "disabled";
                  const micOff = feed?.audioFeed === "disabled";
                  const hasAlert = camOff || micOff;

                  return (
                    <div
                      key={stud.email}
                      className={cn(
                        "bg-[#18191B] border rounded-xl overflow-hidden flex flex-col justify-between shadow-lg transition-all",
                        hasAlert ? "border-red-600 bg-red-950/10 shadow-red-900/10" : "border-zinc-850 hover:border-zinc-700/65"
                      )}
                    >
                      {/* Candidate Card Header */}
                      <div className="p-3 bg-[#1F2023] border-b border-zinc-850 flex justify-between items-center">
                        <div className="truncate pr-2 flex-1">
                          <div className="font-bold text-xs text-white truncate">{stud.name || "Real Candidate"}</div>
                          <div className="text-[9px] text-zinc-500 truncate">{stud.email}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full border font-bold text-[8px] uppercase tracking-wider flex items-center gap-1",
                            hasAlert 
                              ? "bg-red-500/10 text-red-500 border-red-500/25 animate-pulse"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}>
                            <span className={cn("w-1 h-1 rounded-full bg-emerald-400 animate-pulse", hasAlert && "bg-red-500")} />
                            {hasAlert ? "OFFLINE" : "Live"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setZoomedStudent(stud.email)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                            title="Expand Dual Camera View"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Video Viewport relative block */}
                      <div className="relative aspect-video bg-[#090A0B] flex items-center justify-center overflow-hidden">
                        
                        {/* Feed rendering: WebRTC vs Offline Alert Banner */}
                        {monitoringActive ? (
                          camOff ? (
                            <div className="absolute inset-0 bg-red-950/40 flex flex-col items-center justify-center text-center p-4 space-y-2 z-10 animate-pulse">
                              <VideoOff className="w-8 h-8 text-red-500" />
                              <span className="text-[9px] text-red-300 font-extrabold uppercase tracking-wider leading-relaxed">
                                Camera disabled<br />by candidate
                              </span>
                            </div>
                          ) : feed?.primaryFeed ? (
                            <img
                              src={feed.primaryFeed}
                              alt={`${stud.name} feed`}
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                          ) : (
                            <video
                              ref={(el) => {
                                videoRefs.current[stud.email] = el;
                                if (el && liveStream && el.srcObject !== liveStream) {
                                  el.srcObject = liveStream;
                                }
                              }}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                          )
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 space-y-1 bg-[#090A0B] z-10">
                            <VideoOff className="w-7 h-7 text-zinc-700" />
                            <span className="text-[9px] text-zinc-600 font-semibold uppercase">Feed Offline</span>
                          </div>
                        )}

                        {/* Top Right GAZE and MIC status overlay */}
                        {monitoringActive && (
                          <>
                            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 text-right">
                              <span className="bg-emerald-600/90 text-white font-extrabold text-[7px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                                GAZE: SECURE
                              </span>
                              <span className={cn(
                                "font-extrabold text-[7px] px-1.5 py-0.5 rounded uppercase tracking-wider bg-emerald-600/90 text-white",
                                micOff && "bg-red-600/95 text-white animate-pulse"
                              )}>
                                MIC: {micOff ? "MUTED" : "ACTIVE"}
                              </span>
                            </div>

                            {/* Simulated Gaze Bounding Box over Face */}
                            {!camOff && (
                              <div className="absolute top-[22%] left-[28%] w-[44%] h-[55%] border-2 border-emerald-500/60 rounded-lg border-dashed pointer-events-none animate-pulse z-10">
                                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400" />
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400" />
                                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400" />
                                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400" />
                                <span className="absolute -top-4.5 left-0 text-[7px] bg-emerald-500 text-emerald-950 font-extrabold px-1 rounded uppercase tracking-wide">
                                  Face Detected (98%)
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        {/* Recording Clip notice badge */}
                        {isRecording && (
                          <div className="absolute top-2 left-2 bg-rose-600/95 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            REC ({recState.remaining}s)
                          </div>
                        )}
                      </div>

                      {/* Row of 6 action buttons at the bottom of video including Force Audio */}
                      <div className="grid grid-cols-6 gap-0.5 p-1 bg-[#121315] border-t border-zinc-850">
                        {/* 1. Prompt Camera */}
                        <button
                          onClick={() => sendProctorCommand(stud.email, "prompt_camera")}
                          title="Prompt Camera"
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded bg-[#1D4ED8] hover:bg-blue-700 text-white text-[6px] font-bold transition-all leading-none gap-0.5 shrink-0"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Prompt Cam</span>
                        </button>
                        
                        {/* 2. Force Camera */}
                        <button
                          onClick={() => sendProctorCommand(stud.email, "force_camera")}
                          title="Force Camera"
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded bg-[#1D4ED8] hover:bg-blue-700 text-white text-[6px] font-bold transition-all leading-none gap-0.5 shrink-0"
                        >
                          <Video className="w-3 h-3" />
                          <span>Force Cam</span>
                        </button>

                        {/* 3. Prompt Audio */}
                        <button
                          onClick={() => sendProctorCommand(stud.email, "prompt_audio")}
                          title="Prompt Audio"
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded bg-[#1D4ED8] hover:bg-blue-700 text-white text-[6px] font-bold transition-all leading-none gap-0.5 shrink-0"
                        >
                          <Mic className="w-3 h-3" />
                          <span>Prompt Aud</span>
                        </button>

                        {/* 4. Force Audio */}
                        <button
                          onClick={() => sendProctorCommand(stud.email, "force_audio")}
                          title="Force Microphone"
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded bg-[#1D4ED8] hover:bg-blue-700 text-white text-[6px] font-bold transition-all leading-none gap-0.5 shrink-0"
                        >
                          <Volume2 className="w-3 h-3 text-rose-350" />
                          <span>Force Aud</span>
                        </button>

                        {/* 5. Listen */}
                        <button
                          onClick={() => toggleListening(stud.email)}
                          title="Listen to student microphone"
                          className={cn(
                            "flex flex-col items-center justify-center py-2 px-0.5 rounded text-white text-[6px] font-bold transition-all leading-none gap-0.5 shrink-0",
                            listeningTo[stud.email] 
                              ? "bg-emerald-600 hover:bg-emerald-700" 
                              : "bg-[#1D4ED8] hover:bg-blue-700"
                          )}
                        >
                          {listeningTo[stud.email] ? <Volume2 className="w-3 h-3 animate-pulse" /> : <VolumeX className="w-3 h-3" />}
                          <span>Listen</span>
                        </button>

                        {/* 6. Record */}
                        <button
                          onClick={() => recordClip(stud.email)}
                          title="Record clip as evidence"
                          className={cn(
                            "flex flex-col items-center justify-center py-2 px-0.5 rounded text-white text-[6px] font-bold transition-all leading-none gap-0.5 shrink-0",
                            recState?.active 
                              ? "bg-rose-600 animate-pulse hover:bg-rose-700" 
                              : "bg-[#1D4ED8] hover:bg-blue-700"
                          )}
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500 border border-white" />
                          <span>Record</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {studentsList.length === 0 && (
                <div className="py-20 text-center text-zinc-500 border border-zinc-800 border-dashed rounded-xl">
                  No active students are currently connected to this exam session.
                </div>
              )}
            </div>
          )}

          {/* Incident Log History Tab View */}
          {activeTab === "history" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 text-white">
              
              {/* Left Column: Monitored Candidates List */}
              <div className="xl:col-span-3 space-y-4">
                <div className="bg-[#18191B] rounded-xl border border-zinc-850 p-4">
                  <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase mb-3 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-red-500" />
                    Monitored Candidates
                  </h2>
                  <div className="space-y-1.5">
                    {studentsList.map((stud) => {
                      const active = stud.email === selectedStudent;
                      return (
                        <button
                          key={stud.email}
                          onClick={() => setSelectedStudent(stud.email)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border border-transparent",
                            active
                              ? "bg-zinc-800 text-white border-zinc-700/60 shadow"
                              : "hover:bg-zinc-850 text-zinc-300 hover:text-white"
                          )}
                        >
                          <div className="truncate font-semibold">{stud.name || "Real Candidate"}</div>
                          <div className="truncate text-[10px] text-zinc-500 mt-0.5">{stud.email}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Screen share, PIP cameras, and Log timeline */}
              <div className="xl:col-span-9 space-y-6">
                {selectedStudent ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Main screen share and PIP cameras frame */}
                      <div className="lg:col-span-8 space-y-4">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#090A0B] border border-zinc-850 flex items-center justify-center group shadow-2xl">
                          {/* Screen share view */}
                          <div className="absolute inset-0 flex items-center justify-center p-4">
                            <Monitor className="w-12 h-12 text-zinc-800 absolute group-hover:scale-105 transition-transform" />
                            <img
                              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
                              alt="Student Screen Share"
                              className="w-full h-full object-cover opacity-80 rounded border border-zinc-800"
                            />
                          </div>
                          <div className="absolute top-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] text-white font-bold">
                            MONITORED WORKSPACE SCREEN
                          </div>
                        </div>

                        {/* Dual Camera Angles Side-by-Side */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Front Webcam feed */}
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#090A0B] border border-zinc-850 flex items-center justify-center">
                            <div className="absolute top-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] text-white z-10 font-bold">
                              PRIMARY WEBCAM: FRONT
                            </div>
                            {monitoringActive ? (
                              liveFeeds[selectedStudent]?.primaryFeed === "disabled" ? (
                                <div className="absolute inset-0 bg-red-955/40 flex flex-col items-center justify-center text-center p-2 z-10 animate-pulse">
                                  <VideoOff className="w-6 h-6 text-red-500 mb-1" />
                                  <span className="text-[8px] text-red-300 font-extrabold uppercase">Camera disabled</span>
                                </div>
                              ) : liveFeeds[selectedStudent]?.primaryFeed ? (
                                <img
                                  src={liveFeeds[selectedStudent].primaryFeed}
                                  alt="Front View"
                                  className="w-full h-full object-cover scale-x-[-1]"
                                />
                              ) : (
                                <video
                                  ref={(el) => {
                                    videoRefs.current[selectedStudent] = el;
                                    if (el && liveStream && el.srcObject !== liveStream) {
                                      el.srcObject = liveStream;
                                    }
                                  }}
                                  autoPlay
                                  playsInline
                                  muted
                                  className="w-full h-full object-cover scale-x-[-1]"
                                />
                              )
                            ) : (
                              <span className="text-xs text-zinc-650">Front Feed Offline</span>
                            )}
                          </div>

                          {/* Secondary Mobile support camera */}
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#090A0B] border border-zinc-850 flex items-center justify-center">
                            <div className="absolute top-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] text-white z-10 font-bold">
                              SUPPORT CAMERA: DESK VIEW
                            </div>
                            {monitoringActive && liveFeeds[selectedStudent]?.secondaryFeed ? (
                              <img
                                src={liveFeeds[selectedStudent].secondaryFeed}
                                alt="Support View"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-2">
                                <PhoneOff className="w-6 h-6 text-zinc-700 mx-auto mb-1" />
                                <span className="text-[10px] text-zinc-550 block">Support Feed Offline</span>
                                <span className="text-[8px] text-zinc-655 block mt-0.5">Pair mobile support camera</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Security status & timeline check */}
                        <div className="bg-[#18191B] rounded-xl border border-zinc-850 p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Exam Security Status</h3>
                              <p className="text-base font-bold text-white mt-0.5">Timeline Integrity Check</p>
                            </div>
                            <div className={cn("px-3 py-1 rounded-full border text-xs font-bold", riskAnalysis.color)}>
                              {riskAnalysis.rating} (Risk: {riskAnalysis.score}%)
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-[10px] text-zinc-500 font-semibold flex justify-between">
                              <span>START OF EXAM</span>
                              <span>CURRENT MOMENT</span>
                            </div>
                            <div className="relative h-6 bg-[#090A0B] rounded-full overflow-hidden flex border border-zinc-800">
                              {studentEvents.length === 0 ? (
                                <div className="w-full bg-emerald-600/10 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                                  CLEAN TIMELINE RECORD
                                </div>
                              ) : (
                                studentEvents.map((e) => {
                                  const severity = e.payload?.severity || "";
                                  const color =
                                    severity === "red" || e.eventType === "tab_switch_paused"
                                      ? "bg-red-500"
                                      : severity === "yellow"
                                        ? "bg-amber-500"
                                        : "bg-emerald-500";
                                  const width = (100 / studentEvents.length).toFixed(1) + "%";
                                  return (
                                    <div
                                      key={e.id}
                                      style={{ width }}
                                      className={cn("h-full border-r border-zinc-900/60 cursor-pointer hover:brightness-110 transition-all", color)}
                                      title={`${e.eventType}: ${e.payload?.description || "Incident"}`}
                                    />
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Intervention panel and command dispatchers */}
                      <div className="lg:col-span-4 space-y-4">
                        <div className="bg-[#18191B] rounded-xl border border-zinc-855 p-4 flex flex-col justify-between h-full min-h-[360px]">
                          <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                              <MessageSquare className="w-4 h-4 text-red-500" />
                              Live Intervention Chat
                            </h3>

                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {proctorChats.map((c) => (
                                <div key={c.id} className="bg-red-550/10 border border-red-500/20 rounded-lg p-2.5 space-y-1">
                                  <div className="text-[9px] text-red-400 font-bold flex justify-between">
                                    <span>PROCTOR WARNING</span>
                                    <span>{c.time}</span>
                                  </div>
                                  <div className="text-xs text-zinc-200 leading-relaxed">{c.msg}</div>
                                </div>
                              ))}
                              {proctorChats.length === 0 && (
                                <p className="text-center text-xs text-zinc-500 py-8">
                                  No warnings sent. Click a quick alert below to intervene.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 pt-3 border-t border-zinc-800">
                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Quick Warnings</div>
                            <div className="grid grid-cols-1 gap-1">
                              {PRESET_WARNINGS.map((warn, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => sendIntervention(warn)}
                                  className="w-full text-left px-2.5 py-1.5 rounded bg-[#1C1D21] hover:bg-red-500/10 hover:text-red-400 border border-zinc-800 text-[10px] font-medium transition-all"
                                >
                                  {warn}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Hardware Stream Overrides */}
                          <div className="space-y-2 pt-3 border-t border-zinc-800 mt-2">
                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Stream Action Commands</div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => sendProctorCommand(selectedStudent || "", "prompt_camera")}
                                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/25 rounded text-[9px] font-bold transition-all"
                              >
                                Prompt Camera
                              </button>
                              <button
                                onClick={() => sendProctorCommand(selectedStudent || "", "force_camera")}
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/25 rounded text-[9px] font-bold transition-all"
                              >
                                Force Camera
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Detailed history log table/timeline */}
                    <div className="bg-[#18191B] rounded-xl border border-zinc-850 p-4 space-y-3">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Detailed Log History</h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {studentEvents.map((e) => {
                          const severity = e.payload?.severity || "";
                          const excused = e.dismissedAt !== null;
                          const Icon =
                            severity === "red" || e.eventType === "tab_switch_paused"
                              ? AlertCircle
                              : severity === "yellow"
                                ? AlertTriangle
                                : CheckCircle;
                          const color =
                            severity === "red" || e.eventType === "tab_switch_paused"
                              ? "text-red-400 bg-red-650/10 border-red-500/20"
                              : severity === "yellow"
                                ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                          return (
                            <div
                              key={e.id}
                              className={cn(
                                "flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border text-xs font-medium transition-all",
                                color,
                                excused && "opacity-60 bg-zinc-800/10"
                              )}
                            >
                              <div className="flex items-start gap-2.5">
                                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-semibold text-white">
                                    {e.eventType.toUpperCase().replace(/_/g, " ")}
                                    {excused && <span className="ml-2 text-[9px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20">Excused</span>}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 mt-0.5">
                                    {e.payload?.description || "No description provided."}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                                {!excused && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => excuseEvent(e.id)}
                                    className="h-6 text-[9px] px-2"
                                  >
                                    Excuse
                                  </Button>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => deleteEvent(e.id)}
                                    className="text-zinc-500 hover:text-red-400 transition-all p-1"
                                    title="Delete Log Entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {new Date(e.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-xs text-zinc-500 py-16">No candidates selected.</p>
                )}
              </div>
            </div>
          )}

          {/* 3. Alerts Tab View */}
          {activeTab === "alerts" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
                Active Integrity Alerts Feed
              </h2>
              <div className="bg-[#18191B] border border-zinc-850 rounded-xl overflow-hidden shadow-lg p-4 space-y-3">
                {events.filter(e => e.dismissedAt === null).length === 0 ? (
                  <div className="py-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <span>No active alerts raised. All candidate timelines are secure.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.filter(e => e.dismissedAt === null).map((e) => (
                      <div key={e.id} className="p-3 bg-red-650/10 border border-red-500/25 rounded-lg flex items-center justify-between text-xs gap-4">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                          <div>
                            <p className="font-bold text-white">{e.user.name || "Candidate"} ({e.user.email})</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              <strong>Event:</strong> {e.eventType.replace(/_/g, " ").toUpperCase()} · {e.payload?.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => excuseEvent(e.id)}>
                            Excuse
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="destructive" className="h-7 text-[10px] bg-red-600" onClick={() => deleteEvent(e.id)}>
                              Delete
                            </Button>
                          )}
                          <span className="text-[9px] text-zinc-500 ml-2 font-mono">{new Date(e.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Reports Tab View */}
          {activeTab === "reports" && (
            <div className="space-y-5 text-white">
              <h2 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-500" />
                Exam Security Analysis & Statistics
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#18191B] border border-zinc-850 p-5 rounded-xl flex items-center justify-between shadow">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Flagged Incidents</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums">{events.length}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-amber-500/20" />
                </div>
                <div className="bg-[#18191B] border border-zinc-850 p-5 rounded-xl flex items-center justify-between shadow">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Active Alerts</p>
                    <p className="text-2xl font-bold mt-1 text-rose-500 tabular-nums">{activeAlertsCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-rose-500/20" />
                </div>
                <div className="bg-[#18191B] border border-zinc-850 p-5 rounded-xl flex items-center justify-between shadow">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Excused Records</p>
                    <p className="text-2xl font-bold mt-1 text-emerald-500 tabular-nums">{events.length - activeAlertsCount}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-emerald-500/20" />
                </div>
              </div>

              {/* Statistics Details */}
              <div className="bg-[#18191B] border border-zinc-850 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase text-zinc-400">Incident Distribution</h3>
                <div className="space-y-3.5">
                  {[
                    { label: "Tab Switches", count: events.filter(e => e.eventType === "tab_switch_paused").length },
                    { label: "Face Offscreen", count: events.filter(e => e.eventType === "face_not_detected").length },
                    { label: "Mic Muted / Off", count: events.filter(e => e.eventType === "audio_spike_detected" || e.eventType.includes("audio")).length },
                    { label: "Other Warnings", count: events.filter(e => !["tab_switch_paused", "face_not_detected"].includes(e.eventType)).length },
                  ].map((item, idx) => {
                    const pct = events.length > 0 ? (item.count / events.length) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className="flex justify-between font-semibold">
                          <span>{item.label}</span>
                          <span>{item.count} ({Math.round(pct)}%)</span>
                        </div>
                        <div className="h-2 bg-[#090A0B] rounded-full overflow-hidden border border-zinc-800">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 5. Settings Tab View */}
          {activeTab === "settings" && (
            <div className="space-y-4 text-white">
              <h2 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                <Sliders className="w-5 h-5 text-zinc-400" />
                Invigilator Sensitivity Options
              </h2>
              <div className="bg-[#18191B] border border-zinc-850 rounded-xl p-5 space-y-4 max-w-xl">
                <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800">
                  <div>
                    <p className="font-bold">Strict Fullscreen Enforcement</p>
                    <p className="text-zinc-500 mt-0.5">Locks students out when exiting full screen.</p>
                  </div>
                  <span className="text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">Active</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800">
                  <div>
                    <p className="font-bold">Gaze Out-of-bounds Check</p>
                    <p className="text-zinc-500 mt-0.5">AI tracks gaze shifts offscreen.</p>
                  </div>
                  <span className="text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">Medium</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold">Audio Threshold level</p>
                    <p className="text-zinc-500 mt-0.5">Flag spike sound above 55 decibels.</p>
                  </div>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700 font-bold uppercase">55 dB</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Expanded Multi-Angle Fullscreen Modal */}
      {zoomedStudent && (
        <div className="fixed inset-0 z-50 bg-[#090A0B]/95 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#141519] border border-zinc-800 rounded-2xl w-full max-w-4xl p-6 relative flex flex-col gap-6 shadow-2xl">
            <button
              onClick={() => setZoomedStudent(null)}
              className="absolute top-4 right-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full px-4 py-2 transition-all text-xs font-bold"
            >
              Close View
            </button>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Expanded Multi-Angle Monitoring: {studentsList.find(s => s.email === zoomedStudent)?.name || zoomedStudent}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Simultaneous front webcam and desktop support angle view.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {/* Primary Front Camera view */}
              <div className="relative aspect-video bg-[#090A0B] border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center">
                <div className="absolute top-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] text-white z-10 font-bold">
                  PRIMARY CAMERA: FRONT VIEW
                </div>
                {liveFeeds[zoomedStudent]?.primaryFeed === "disabled" ? (
                  <div className="absolute inset-0 bg-red-955/40 flex flex-col items-center justify-center text-center p-4 space-y-2 z-10 animate-pulse">
                    <VideoOff className="w-8 h-8 text-red-500" />
                    <span className="text-[10px] text-red-300 font-extrabold uppercase tracking-wider leading-relaxed">
                      Camera disabled<br />by candidate
                    </span>
                  </div>
                ) : liveFeeds[zoomedStudent]?.primaryFeed ? (
                  <img src={liveFeeds[zoomedStudent]?.primaryFeed} alt="Front View" className="w-full h-full object-cover scale-x-[-1]" />
                ) : liveStream ? (
                  <video
                    ref={(el) => {
                      if (el) el.srcObject = liveStream;
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-zinc-600 text-xs font-semibold">Front Feed Offline</div>
                )}
              </div>

              {/* Secondary Mobile support camera view */}
              <div className="relative aspect-video bg-[#090A0B] border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center">
                <div className="absolute top-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] text-white z-10 font-bold">
                  SUPPORT CAMERA: DESK VIEW
                </div>
                {liveFeeds[zoomedStudent]?.secondaryFeed ? (
                  <img src={liveFeeds[zoomedStudent]?.secondaryFeed} alt="Desk View" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <PhoneOff className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <div className="text-zinc-550 text-xs font-semibold animate-pulse">Desk View Offline</div>
                    <div className="text-[10px] text-zinc-650 mt-1">Connect mobile support camera</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
