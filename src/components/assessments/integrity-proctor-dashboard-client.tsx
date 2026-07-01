"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
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

  // Live stream invigilation states
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [monitoringActive, setMonitoringActive] = useState(true);
  const [liveFeeds, setLiveFeeds] = useState<
    Record<string, { primaryFeed?: string; secondaryFeed?: string }>
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

  // Preset warnings
  const PRESET_WARNINGS = [
    "Please look directly at the screen.",
    "Webcam must show your full face clearly.",
    "Multiple people detected. Ensure you are alone.",
    "Audio spike detected. Please keep the environment quiet.",
  ];

  // Unique list of students in the logs
  const studentsList = useMemo(() => {
    const list = new Map<string, { name: string | null; email: string }>();
    events.forEach((e) => {
      list.set(e.user.email, e.user);
    });
    return Array.from(list.values());
  }, [events]);

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
    const feed = liveFeeds[studentEmail];

    if (feed?.primaryFeed && feed.primaryFeed !== "disabled") {
      // Trigger download from base64 string
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

      // Trigger download
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

      // Trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `evidence_clip_${studentEmail.replace(/[@.]/g, "_")}.webm`;
      link.click();

      setRecordingStates((prev) => ({ ...prev, [studentEmail]: { active: false, remaining: 0 } }));

      // Log incident
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

  // Dispatch real-time invigilator prompts to candidate page
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

  return (
    <div className="space-y-6 text-foreground">
      {/* Role-based Tab switcher */}
      <div className="flex border-b border-border/80 dark:border-white/10">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "live"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Live Grid Monitor
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="w-4 h-4" />
          Incident Log History
        </button>
      </div>

      {/* 1. Live Grid Monitor Tab */}
      {activeTab === "live" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border/60">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500" />
                Live Invigilation Console (Role: Staff)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start feeds to watch candidate webcams live. Use captures to log evidence.
              </p>
            </div>
            <div>
              {!monitoringActive ? (
                <Button
                  onClick={startLiveMonitoring}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Video className="w-4 h-4" />
                  Start Live Feeds
                </Button>
              ) : (
                <Button
                  onClick={stopLiveMonitoring}
                  variant="destructive"
                  className="flex items-center gap-1.5 text-xs font-semibold"
                >
                  <VideoOff className="w-4 h-4" />
                  Stop Live Feeds
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studentsList.map((stud) => {
              const recState = recordingStates[stud.email];
              const isRecording = recState?.active;
              
              return (
                <div
                  key={stud.email}
                  className="surface-glass rounded-xl border border-border overflow-hidden flex flex-col justify-between shadow-sm"
                >
                  {/* Student Header */}
                  <div className="p-3 bg-muted/40 border-b border-border/60 flex justify-between items-start">
                    <div className="truncate pr-2">
                      <div className="font-bold text-xs truncate">{stud.name}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{stud.email}</div>
                    </div>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold shrink-0">
                      ACTIVE
                    </span>
                  </div>

                  {/* Video Viewport */}
                  <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                    {monitoringActive && liveFeeds[stud.email]?.primaryFeed && liveFeeds[stud.email].primaryFeed !== "disabled" ? (
                      <img
                        src={liveFeeds[stud.email].primaryFeed}
                        alt={`${stud.name || stud.email} feed`}
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
                        className={`w-full h-full object-cover scale-x-[-1] ${
                          !monitoringActive || (liveFeeds[stud.email]?.primaryFeed && liveFeeds[stud.email].primaryFeed !== "disabled") ? "hidden" : ""
                        }`}
                      />
                    )}

                    {monitoringActive && liveFeeds[stud.email]?.primaryFeed === "disabled" && (
                      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-4 space-y-1.5 z-10">
                        <VideoOff className="w-8 h-8 text-rose-500/80 animate-pulse" />
                        <span className="text-[10px] text-rose-400 font-semibold">
                          Camera feed disabled by candidate
                        </span>
                      </div>
                    )}

                    {monitoringActive && (
                      <>
                        {/* Blinking Live Indicator */}
                        <div className="absolute top-2 right-2 bg-emerald-500/90 text-emerald-950 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 z-10">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-950 animate-pulse" />
                          LIVE FEED
                        </div>

                        {/* Face bounding box overlay (only when camera is active) */}
                        {liveFeeds[stud.email]?.primaryFeed !== "disabled" && (
                          <div className="absolute top-[22%] left-[28%] w-[44%] h-[55%] border-2 border-emerald-500/60 rounded-lg border-dashed pointer-events-none animate-pulse z-10">
                            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400" />
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400" />
                            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400" />
                            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400" />
                            
                            <span className="absolute -top-5 left-0 text-[7px] bg-emerald-500 text-emerald-950 font-extrabold px-1 rounded uppercase tracking-wide">
                              Face Detected (98%)
                            </span>
                          </div>
                        )}

                        {/* Telemetry data overlay */}
                        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[7px] text-emerald-400 font-mono pointer-events-none bg-slate-950/85 px-2 py-1 rounded border border-emerald-500/20 z-10">
                          <span>GAZE: SECURE</span>
                          <span>MIC: ACTIVE</span>
                          <span>SECURE PORT: WebRTC</span>
                        </div>

                        {/* Paired Mobile Support Feed PIP */}
                        {liveFeeds[stud.email]?.secondaryFeed && liveFeeds[stud.email].secondaryFeed !== "disabled" && (
                          <div className="absolute bottom-2 right-2 w-16 aspect-video bg-black rounded border border-slate-700 overflow-hidden shadow-lg z-20 hover:scale-150 transition-all duration-300">
                            <img
                              src={liveFeeds[stud.email].secondaryFeed}
                              alt="Support Cam"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-0.5 left-0.5 bg-teal-500/85 text-[6px] text-slate-950 font-bold px-0.8 rounded">
                              SEC
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {!monitoringActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 space-y-1.5">
                        <VideoOff className="w-8 h-8 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Video stream offline
                        </span>
                      </div>
                    )}

                    {isRecording && (
                      <div className="absolute top-2 left-2 bg-rose-600/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse z-10">
                        <span className="w-1 h-1 rounded-full bg-white" />
                        REC ({recState.remaining}s)
                      </div>
                    )}
                  </div>

                  {/* Proctor Request Bar */}
                  <div className="px-3 py-2 bg-muted/10 grid grid-cols-2 gap-2 border-t border-border/40">
                    <button
                      onClick={() => sendProctorCommand(stud.email, "prompt_camera")}
                      className="w-full text-[9px] font-semibold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded py-1 transition-all"
                    >
                      Prompt Camera
                    </button>
                    <button
                      onClick={() => sendProctorCommand(stud.email, "force_camera")}
                      className="w-full text-[9px] font-semibold text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded py-1 transition-all"
                    >
                      Force Camera
                    </button>
                    <button
                      onClick={() => sendProctorCommand(stud.email, "prompt_audio")}
                      className="w-full text-[9px] font-semibold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded py-1 transition-all"
                    >
                      Prompt Audio
                    </button>
                    <button
                      onClick={() => sendProctorCommand(stud.email, "force_audio")}
                      className="w-full text-[9px] font-semibold text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded py-1 transition-all"
                    >
                      Force Audio
                    </button>
                  </div>

                  {/* Invigilator Evidence Capture Panel */}
                  <div className="p-3 bg-muted/20 flex flex-col gap-2 border-t border-border/60">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => takeSnapshot(stud.email)}
                        disabled={!monitoringActive}
                        className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/95 text-[10px] flex items-center justify-center gap-1 h-8"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Snapshot
                      </Button>
                      <Button
                        onClick={() => recordClip(stud.email)}
                        disabled={!monitoringActive || isRecording}
                        variant="outline"
                        className="flex-1 border-border/80 text-[10px] font-bold flex items-center justify-center gap-1 h-8"
                      >
                        <Video className="w-3.5 h-3.5 text-rose-500" />
                        Record Clip
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => toggleListening(stud.email)}
                        disabled={!monitoringActive}
                        variant={listeningTo[stud.email] ? "default" : "outline"}
                        className={`flex-1 text-[10px] font-bold flex items-center justify-center gap-1 h-8 ${
                          listeningTo[stud.email]
                            ? "bg-emerald-600 hover:bg-emerald-505 text-white border-none"
                            : "border-border/80"
                        }`}
                      >
                        {listeningTo[stud.email] ? (
                          <>
                            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                            Listening
                          </>
                        ) : (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                            Listen Mic
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => toggleAudioRecording(stud.email)}
                        disabled={!monitoringActive}
                        variant="outline"
                        className={`flex-1 text-[10px] font-bold flex items-center justify-center gap-1 h-8 ${
                          audioRecordingStates[stud.email]?.active
                            ? "bg-rose-600 hover:bg-rose-500 text-white border-none animate-pulse"
                            : "border-border/80"
                        }`}
                      >
                        {audioRecordingStates[stud.email]?.active ? (
                          <>
                            <Mic className="w-3.5 h-3.5 text-white" />
                            Recording ({audioRecordingStates[stud.email]?.duration}s)
                          </>
                        ) : (
                          <>
                            <MicOff className="w-3.5 h-3.5 text-rose-500" />
                            Record Audio
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {studentsList.length === 0 && (
              <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No active exam sessions to display.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Incident Log History Tab */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Sidebar: Student list */}
          <div className="xl:col-span-3 space-y-4">
            <div className="surface-glass rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" />
                Monitored Candidates
              </h2>
              <div className="space-y-1.5">
                {studentsList.map((stud) => {
                  const active = stud.email === selectedStudent;
                  return (
                    <button
                      key={stud.email}
                      onClick={() => setSelectedStudent(stud.email)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="truncate font-semibold">{stud.name}</div>
                      <div
                        className={`truncate text-[10px] ${
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {stud.email}
                      </div>
                    </button>
                  );
                })}
                {studentsList.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No active exam logs.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main monitoring feeds */}
          <div className="xl:col-span-9 space-y-6">
            {selectedStudent ? (
              <>
                {/* Split layout: Video feeds & Timeline */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: PIP Video Feeds */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-border flex items-center justify-center group shadow-md">
                      {/* Outer Main Frame: Screen Share */}
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <Monitor className="w-16 h-16 text-slate-800 absolute group-hover:scale-105 transition-transform" />
                        <img
                          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
                          alt="Student Screen Share"
                          className="w-full h-full object-cover opacity-90 rounded border border-slate-800"
                        />
                      </div>

                      {/* Floating PIP frame: Webcam (Student Face View) */}
                      <div className="absolute bottom-4 right-4 w-32 md:w-40 aspect-video bg-black rounded-lg overflow-hidden border-2 border-primary shadow-2xl flex items-center justify-center cursor-move transition-transform hover:scale-105">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
                          alt="Student Webcam Feed"
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        <div className="absolute bottom-1 left-1 bg-black/60 px-1 py-0.5 rounded text-[8px] text-white">
                          Webcam
                        </div>
                      </div>

                      {/* Secondary Pairing: Desk View (WebRTC) */}
                      <div className="absolute bottom-4 left-4 w-32 md:w-40 aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl flex items-center justify-center">
                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                          <Sparkles className="w-4 h-4 text-teal-400" />
                          <span className="text-[9px] text-white font-medium">Desk View (Mobile)</span>
                          <span className="text-[8px] text-emerald-400 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            P2P Stream Active
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Level Summary & Timeline */}
                    <div className="surface-glass rounded-xl border border-border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Exam Security Status
                          </h3>
                          <p className="text-lg font-bold text-foreground">Timeline Integrity Check</p>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full border text-xs font-bold ${riskAnalysis.color}`}
                        >
                          {riskAnalysis.rating} (Risk: {riskAnalysis.score}%)
                        </div>
                      </div>

                      {/* Incident Risk Timeline visualization bar */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground font-semibold flex justify-between">
                          <span>START OF EXAM</span>
                          <span>CURRENT MOMENT</span>
                        </div>
                        <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
                          {studentEvents.length === 0 ? (
                            <div className="w-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-emerald-950">
                              CLEAN RECORD
                            </div>
                          ) : (
                            studentEvents.map((e) => {
                              const severity = e.payload?.severity || "";
                              const color =
                                severity === "red" || e.eventType === "tab_switch_paused"
                                  ? "bg-rose-500"
                                  : severity === "yellow"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500";
                              const width = (100 / studentEvents.length).toFixed(1) + "%";
                              return (
                                <div
                                  key={e.id}
                                  style={{ width }}
                                  className={`h-full border-r border-slate-900/40 ${color} cursor-pointer hover:brightness-110 transition-all`}
                                  title={`${e.eventType}: ${e.payload?.description || "Incident"}`}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Chat Intervention */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="surface-glass rounded-xl border border-border p-4 flex flex-col h-full min-h-[360px] justify-between">
                      <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-primary" />
                          Live Intervention Chat
                        </h3>

                        {/* Live messages listing */}
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {proctorChats.map((c) => (
                            <div
                              key={c.id}
                              className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 space-y-1"
                            >
                              <div className="text-[10px] text-primary font-semibold flex justify-between">
                                <span>PROCTOR ALERT</span>
                                <span>{c.time}</span>
                              </div>
                              <div className="text-xs text-foreground leading-relaxed">{c.msg}</div>
                            </div>
                          ))}
                          {proctorChats.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground py-12">
                              No messages sent. Click a quick warning below to alert the student.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preset warning buttons */}
                      <div className="space-y-2 pt-4 border-t border-border">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Quick Warnings
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {PRESET_WARNINGS.map((warn, idx) => (
                            <button
                              key={idx}
                              onClick={() => sendIntervention(warn)}
                              className="w-full text-left px-2.5 py-1.5 rounded bg-muted hover:bg-primary/20 hover:text-primary transition-all text-[10px] font-medium border border-border/40"
                            >
                              {warn}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Remote Hardware Controls */}
                      <div className="space-y-2 pt-4 border-t border-border mt-3">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Student Stream Controls
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => sendProctorCommand(selectedStudent || "", "prompt_camera")}
                            className="px-2.5 py-1.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-[9px] font-bold"
                          >
                            Prompt Camera
                          </button>
                          <button
                            onClick={() => sendProctorCommand(selectedStudent || "", "force_camera")}
                            className="px-2.5 py-1.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all text-[9px] font-bold"
                          >
                            Force Camera
                          </button>
                          <button
                            onClick={() => sendProctorCommand(selectedStudent || "", "prompt_audio")}
                            className="px-2.5 py-1.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-[9px] font-bold"
                          >
                            Prompt Audio
                          </button>
                          <button
                            onClick={() => sendProctorCommand(selectedStudent || "", "force_audio")}
                            className="px-2.5 py-1.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all text-[9px] font-bold"
                          >
                            Force Audio
                          </button>
                        </div>

                        {/* Direct Stream Capture & Monitoring */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 mt-2">
                          <button
                            onClick={() => toggleListening(selectedStudent || "")}
                            className={`px-2.5 py-1.5 rounded transition-all text-[9px] font-bold flex items-center justify-center gap-1 ${
                              listeningTo[selectedStudent || ""]
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            }`}
                          >
                            {listeningTo[selectedStudent || ""] ? (
                              <>
                                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                                Listening
                              </>
                            ) : (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                                Listen Mic
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => toggleAudioRecording(selectedStudent || "")}
                            className={`px-2.5 py-1.5 rounded transition-all text-[9px] font-bold flex items-center justify-center gap-1 ${
                              audioRecordingStates[selectedStudent || ""]?.active
                                ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            }`}
                          >
                            {audioRecordingStates[selectedStudent || ""]?.active ? (
                              <>
                                <Mic className="w-3.5 h-3.5 text-white" />
                                Rec ({audioRecordingStates[selectedStudent || ""]?.duration}s)
                              </>
                            ) : (
                              <>
                                <MicOff className="w-3.5 h-3.5 text-rose-500" />
                                Record Audio
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Smart Incident Log list */}
                <div className="surface-glass rounded-xl border border-border p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Detailed Log History
                  </h3>
                  <div className="space-y-2">
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
                          ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                          : severity === "yellow"
                          ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                          : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";

                      return (
                        <div
                          key={e.id}
                          className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border text-xs font-medium transition-all ${color}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-foreground">
                                {e.eventType.toUpperCase().replace(/_/g, " ")}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
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
                                className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5"
                              >
                                <Maximize2 className="w-3 h-3" /> Screen Capture
                              </a>
                            )}
                            {e.eventType === "evidence_snapshot" && (
                              <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5">
                                <Download className="w-3 h-3" /> Photo Saved
                              </span>
                            )}
                            {e.eventType === "evidence_clip" && (
                              <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5">
                                <Download className="w-3 h-3" /> Clip Saved
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground tabular-nums">
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
              <div className="text-center py-20 text-muted-foreground border border-border border-dashed rounded-xl">
                No monitored students have generated logs for this assessment yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
