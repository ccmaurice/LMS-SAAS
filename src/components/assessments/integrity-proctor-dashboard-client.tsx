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
  HardDrive
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

const MOCK_STUDENTS = [
  { name: "Emily Chen", email: "emily.chen@school.edu", image: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&q=80" },
  { name: "Liam Patel", email: "liam.patel@school.edu", image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80" },
  { name: "Chloe Dubois", email: "chloe.dubois@school.edu", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80" },
  { name: "Mateo Rossi", email: "mateo.rossi@school.edu", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" },
  { name: "Chloe Dubois", email: "chloe2.dubois@school.edu", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80" },
  { name: "Liam Patel", email: "liam2.patel@school.edu", image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80" },
  { name: "Enise Hunosi", email: "enise.hunosi@school.edu", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80" },
  { name: "Liam Patel", email: "liam3.patel@school.edu", image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80" },
  { name: "Mateo Rossi", email: "mateo2.rossi@school.edu", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" },
  { name: "Chloe Dubois", email: "chloe3.dubois@school.edu", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80" },
  { name: "Liam Patel", email: "liam4.patel@school.edu", image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80" },
  { name: "Liam Juhon", email: "juhon.lim@school.edu", image: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&q=80" },
  { name: "Jang Chen", email: "jang.chen@school.edu", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80" },
  { name: "Liam Patel", email: "liam5.patel@school.edu", image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80" },
  { name: "Chloe Dubois", email: "chloe4.dubois@school.edu", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80" },
  { name: "Keliyo Bubois", email: "keliyo.bubois@school.edu", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80" }
];

export function IntegrityProctorDashboardClient({
  initialEvents,
  _assessmentTitle,
  _assessmentId,
}: {
  initialEvents: ProctorEvent[];
  _assessmentTitle: string;
  _assessmentId: string;
}) {
  const [events, setEvents] = useState<ProctorEvent[]>(initialEvents);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(
    initialEvents[0]?.user.email || null
  );
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");

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

  // Custom mock chat alerts sent by proctor
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

  // Compute final student list (Merging DB students + Mock students to fill up to 16 cards)
  const studentsList = useMemo(() => {
    const dbList = new Map<string, { name: string | null; email: string; isMock: boolean; image?: string }>();
    events.forEach((e) => {
      dbList.set(e.user.email, { name: e.user.name, email: e.user.email, isMock: false });
    });
    const dbArr = Array.from(dbList.values());

    const filteredMocks = MOCK_STUDENTS.filter(
      (m) => !dbArr.some((dbStud) => dbStud.email.toLowerCase() === m.email.toLowerCase())
    ).map(m => ({ name: m.name, email: m.email, isMock: true, image: m.image }));

    return [...dbArr, ...filteredMocks].slice(0, 16);
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
      let name = "";
      if (err instanceof Error) {
        name = err.name;
      } else if (typeof err === "object" && err !== null) {
        name = (err as { name?: string }).name || "";
      }
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        alert("Camera permission was denied. Please allow camera access in your browser settings to start live monitoring.");
      } else {
        alert("Could not access camera for monitoring grid. Please check your camera connection.");
      }
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

                  // 1. Play if listening is enabled
                  if (listeningTo[f.studentEmail]) {
                    const audioUri = `data:audio/webm;base64,${f.audioFeed}`;
                    const audio = new Audio(audioUri);
                    audio.play().catch((err) => {
                      console.warn("Failed to play student audio chunk:", err);
                    });
                  }

                  // 2. Accumulate chunk if recording is active
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
    const matchedStud = studentsList.find((s) => s.email === studentEmail);
    if (matchedStud?.isMock && matchedStud.image) {
      const link = document.createElement("a");
      link.href = matchedStud.image;
      link.download = `evidence_snapshot_${studentEmail.replace(/[@.]/g, "_")}.jpg`;
      link.click();
      logSnapshotIncident(studentEmail, matchedStud.image);
      alert(`Snapshot evidence saved for mock candidate ${matchedStud.name}`);
      return;
    }

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
    const matchedStud = studentsList.find((s) => s.email === studentEmail);
    if (matchedStud?.isMock) {
      setRecordingStates((prev) => ({ ...prev, [studentEmail]: { active: true, remaining: 5 } }));
      let count = 5;
      const interval = setInterval(() => {
        count--;
        setRecordingStates((prev) => ({ ...prev, [studentEmail]: { active: true, remaining: count } }));
        if (count <= 0) {
          clearInterval(interval);
          setRecordingStates((prev) => ({ ...prev, [studentEmail]: { active: false, remaining: 0 } }));
          const now = new Date();
          const newEv: ProctorEvent = {
            id: Math.random().toString(),
            eventType: "evidence_clip",
            createdAt: now,
            dismissedAt: null,
            user: { name: matchedStud.name, email: matchedStud.email },
            payload: {
              description: "[SIMULATION] Invigilator recorded a 5-second video clip as evidence",
              severity: "red",
            },
          };
          setEvents((prev) => [newEv, ...prev]);
          alert(`Recorded clip evidence saved for mock candidate ${matchedStud.name}`);
        }
      }, 1000);
      return;
    }

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

  // Dispatch prompt alerts to candidates (real or mock simulated)
  const sendProctorCommand = async (
    studentEmail: string,
    command: "prompt_camera" | "force_camera" | "prompt_audio" | "force_audio"
  ) => {
    const matchedStud = studentsList.find((s) => s.email === studentEmail);
    if (matchedStud?.isMock) {
      const now = new Date();
      let eventType = "proctor_prompt_camera";
      let description = "";
      if (command === "prompt_camera") {
        eventType = "proctor_prompt_camera";
        description = `[SIMULATION] Prompt camera alert sent to mock candidate ${matchedStud.name}`;
      } else if (command === "force_camera") {
        eventType = "proctor_force_camera";
        description = `[SIMULATION] Force camera activation sent to mock candidate ${matchedStud.name}`;
      } else if (command === "prompt_audio") {
        eventType = "proctor_prompt_audio";
        description = `[SIMULATION] Prompt audio alert sent to mock candidate ${matchedStud.name}`;
      } else if (command === "force_audio") {
        eventType = "proctor_force_audio";
        description = `[SIMULATION] Force audio activation sent to mock candidate ${matchedStud.name}`;
      }

      const newEv: ProctorEvent = {
        id: Math.random().toString(),
        eventType,
        createdAt: now,
        dismissedAt: null,
        user: { name: matchedStud.name, email: matchedStud.email },
        payload: { description, severity: "yellow" },
      };
      setEvents((prev) => [newEv, ...prev]);
      alert(`${command.replace(/_/g, " ").toUpperCase()} simulated successfully for mock candidate ${matchedStud.name}`);
      return;
    }

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

  // Trigger quick proctor intervention
  function sendIntervention(msg: string) {
    const now = new Date();
    setProctorChats((prev) => [
      ...prev,
      { id: Math.random().toString(), msg, time: now.toLocaleTimeString() },
    ]);

    if (selectedStudent) {
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
    }
  }

  // Active unexcused alerts count
  const activeAlertsCount = useMemo(() => {
    return events.filter(e => e.dismissedAt === null).length;
  }, [events]);

  return (
    <div className="relative min-h-[640px] flex bg-[#111215] text-white overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
      
      {/* 1. Left Mini-Sidebar Application Navigation */}
      <aside className="w-48 bg-[#141519] border-r border-zinc-800/80 flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          {/* Logo Brand Header */}
          <div className="p-4 border-b border-zinc-800/80 flex items-center gap-2">
            <div className="size-8 rounded-lg bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500">
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
              <LayoutGrid className="w-3.5 h-3.5 text-zinc-400" />
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
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              Candidates
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Alerts
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all">
              <Monitor className="w-3.5 h-3.5" />
              Reports
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all">
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

      {/* 2. Main Right Workspace Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#16171a]">
        
        {/* Top Control Panel Header Bar */}
        <header className="px-6 py-3.5 bg-[#1a1b20] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-red-500" />
            <span className="font-extrabold text-sm tracking-wider uppercase">Integrity Pro</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            {/* Exam selector display */}
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center gap-2 cursor-pointer hover:bg-zinc-750 transition-all text-white">
              <span className="font-bold text-[11px]">Exam:</span>
              <span className="text-zinc-300 truncate max-w-[150px]">{_assessmentTitle || "BIOLOGY 101 (Spring 2024)"}</span>
              <span className="text-[10px] text-zinc-500 font-bold">▼</span>
            </div>

            {/* Candidates selector display */}
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center gap-2 text-white">
              <span className="font-bold text-[11px]">Candidates:</span>
              <span className="text-emerald-400 font-bold">{studentsList.length}/{studentsList.length} Live</span>
            </div>

            {/* Countdown timer ticking */}
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center gap-2 text-white font-mono">
              <span className="text-zinc-400 font-sans font-bold text-[11px]">Time Remaining:</span>
              <span className="text-white font-bold">{formattedTimeLeft}</span>
            </div>

            {/* Active alerts display */}
            <div className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 flex items-center gap-1.5 text-red-400 font-bold animate-pulse">
              <Bell className="w-3.5 h-3.5 text-red-400" />
              <span>Alerts ({activeAlertsCount})</span>
            </div>

            {/* System Health */}
            <div className="hidden lg:flex items-center gap-3 text-[10px] text-zinc-400 font-bold">
              <span>System Health</span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Network
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> CPU
              </span>
            </div>

            {/* Clock display */}
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

              {/* 4-column Candidates Grid layout matching biology exam screenshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {studentsList.map((stud) => {
                  const recState = recordingStates[stud.email];
                  const isRecording = recState?.active;
                  const isMock = stud.isMock;

                  return (
                    <div
                      key={stud.email}
                      className="bg-[#18191B] border border-zinc-850 rounded-xl overflow-hidden flex flex-col justify-between shadow-lg hover:border-zinc-700/65 transition-all"
                    >
                      {/* Candidate Card Header */}
                      <div className="p-3 bg-[#1F2023] border-b border-zinc-850 flex justify-between items-center">
                        <div className="truncate pr-2">
                          <div className="font-bold text-xs text-white truncate">{stud.name}</div>
                          <div className="text-[9px] text-zinc-500 truncate">{stud.email}</div>
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold text-[8px] uppercase tracking-wider flex items-center gap-1 shrink-0">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                          Live
                        </span>
                      </div>

                      {/* Video Viewport relative block */}
                      <div className="relative aspect-video bg-[#090A0B] flex items-center justify-center overflow-hidden">
                        
                        {/* Feed rendering: WebRTC vs Simulated Image */}
                        {monitoringActive ? (
                          !isMock ? (
                            liveFeeds[stud.email]?.primaryFeed && liveFeeds[stud.email].primaryFeed !== "disabled" ? (
                              <img
                                src={liveFeeds[stud.email].primaryFeed}
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
                            // Render high-fidelity student image from Unsplash
                            <img
                              src={stud.image}
                              alt={`${stud.name} simulated camera`}
                              className="w-full h-full object-cover"
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
                                liveFeeds[stud.email]?.audioFeed === "disabled" && "bg-red-650/95 text-white animate-pulse"
                              )}>
                                MIC: {liveFeeds[stud.email]?.audioFeed === "disabled" ? "OFFLINE" : "ACTIVE"}
                              </span>
                            </div>

                            {/* Simulated Gaze Bounding Box over Face */}
                            <div className="absolute top-[22%] left-[28%] w-[44%] h-[55%] border-2 border-emerald-500/60 rounded-lg border-dashed pointer-events-none animate-pulse z-10">
                              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400" />
                              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400" />
                              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400" />
                              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400" />
                              <span className="absolute -top-4.5 left-0 text-[7px] bg-emerald-500 text-emerald-950 font-extrabold px-1 rounded uppercase tracking-wide">
                                Face Detected (98%)
                              </span>
                            </div>
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

                      {/* Row of 5 blue action buttons at the bottom of video matching biology exam screenshot */}
                      <div className="grid grid-cols-5 gap-1 p-2 bg-[#121315] border-t border-zinc-850">
                        {/* 1. Prompt Camera */}
                        <button
                          onClick={() => sendProctorCommand(stud.email, "prompt_camera")}
                          title="Prompt Camera"
                          className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded bg-[#1D4ED8] hover:bg-blue-700 text-white text-[7px] font-semibold transition-all leading-none gap-0.5"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Prompt Camera</span>
                        </button>
                        
                        {/* 2. Force Camera */}
                        <button
                          onClick={() => sendProctorCommand(stud.email, "force_camera")}
                          title="Force Camera"
                          className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded bg-[#1D4ED8] hover:bg-blue-700 text-white text-[7px] font-semibold transition-all leading-none gap-0.5"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Force Camera</span>
                        </button>

                        {/* 3. Prompt Audio */}
                        <button
                          onClick={() => sendProctorCommand(stud.email, "prompt_audio")}
                          title="Prompt Audio"
                          className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded bg-[#1D4ED8] hover:bg-blue-700 text-white text-[7px] font-semibold transition-all leading-none gap-0.5"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>Prompt Audio</span>
                        </button>

                        {/* 4. Listen */}
                        <button
                          onClick={() => toggleListening(stud.email)}
                          title="Listen to student microphone"
                          className={cn(
                            "flex flex-col items-center justify-center py-1.5 px-0.5 rounded text-white text-[7px] font-semibold transition-all leading-none gap-0.5",
                            listeningTo[stud.email] 
                              ? "bg-emerald-600 hover:bg-emerald-700" 
                              : "bg-[#1D4ED8] hover:bg-blue-700"
                          )}
                        >
                          {listeningTo[stud.email] ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
                          <span>Listen</span>
                        </button>

                        {/* 5. Record */}
                        <button
                          onClick={() => recordClip(stud.email)}
                          title="Record snapshot/clip as evidence"
                          className={cn(
                            "flex flex-col items-center justify-center py-1.5 px-0.5 rounded text-white text-[7px] font-semibold transition-all leading-none gap-0.5",
                            recState?.active 
                              ? "bg-rose-600 animate-pulse hover:bg-rose-700" 
                              : "bg-[#1D4ED8] hover:bg-blue-700"
                          )}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
                          <span>Record</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                          <div className="truncate font-semibold">{stud.name}</div>
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
                            <Monitor className="w-16 h-16 text-zinc-800 absolute group-hover:scale-105 transition-transform" />
                            <img
                              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
                              alt="Student Screen Share"
                              className="w-full h-full object-cover opacity-80 rounded border border-zinc-800"
                            />
                          </div>

                          {/* PIP frame: Webcam Face View */}
                          <div className="absolute bottom-4 right-4 w-32 aspect-video bg-black rounded-lg overflow-hidden border-2 border-red-500 shadow-2xl flex items-center justify-center cursor-move transition-transform hover:scale-105">
                            <img
                              src={studentsList.find(s => s.email === selectedStudent)?.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80"}
                              alt="Student Webcam Feed"
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                            <div className="absolute bottom-1 left-1 bg-black/60 px-1 py-0.5 rounded text-[8px] text-white">
                              Webcam
                            </div>
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
                              className={cn("flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border text-xs font-medium transition-all", color)}
                            >
                              <div className="flex items-start gap-2.5">
                                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-semibold text-white">{e.eventType.toUpperCase().replace(/_/g, " ")}</div>
                                  <div className="text-[11px] text-zinc-400 mt-0.5">
                                    {e.payload?.description || "No description provided."}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                                {e.payload?.screenshotUrl && (
                                  <a
                                    href={e.payload.screenshotUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-red-400 hover:underline font-semibold flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5"
                                  >
                                    <Maximize2 className="w-3 h-3" /> Screen Capture
                                  </a>
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

        </main>
      </div>
    </div>
  );
}
