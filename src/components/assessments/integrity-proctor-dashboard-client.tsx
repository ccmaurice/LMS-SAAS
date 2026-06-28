"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, CheckCircle, Shield, Sparkles, MessageSquare, Maximize2, Monitor } from "lucide-react";

type ProctorEvent = {
  id: string;
  eventType: string;
  createdAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  user: { name: string; email: string };
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
  
  // Custom mock chat alerts sent by proctor
  const [proctorChats, setProctorChats] = useState<{ id: string; msg: string; time: string }[]>([]);

  // Preset warnings
  const PRESET_WARNINGS = [
    "Please look directly at the screen.",
    "Webcam must show your full face clearly.",
    "Multiple people detected. Ensure you are alone.",
    "Audio spike detected. Please keep the environment quiet.",
  ];

  // Unique list of students in the logs
  const studentsList = useMemo(() => {
    const list = new Map<string, { name: string; email: string }>();
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

  // Risk calculation based on event history
  const riskAnalysis = useMemo(() => {
    if (studentEvents.length === 0) return { score: 0, rating: "Safe", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
    
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
    return { score, rating: "Safe", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
  }, [studentEvents]);

  // Trigger quick proctor intervention
  function sendIntervention(msg: string) {
    const now = new Date();
    // 1. Add locally to chat timeline
    setProctorChats((prev) => [...prev, { id: Math.random().toString(), msg, time: now.toLocaleTimeString() }]);

    // 2. Log as a proctor event in the database
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 text-foreground">
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
                  <div className={`truncate text-[10px] ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {stud.email}
                  </div>
                </button>
              );
            })}
            {studentsList.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">No active exam logs.</div>
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
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exam Security Status</h3>
                      <p className="text-lg font-bold text-foreground">Timeline Integrity Check</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-xs font-bold ${riskAnalysis.color}`}>
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
                          const color = severity === "red" || e.eventType === "tab_switch_paused" ? "bg-rose-500" : severity === "yellow" ? "bg-amber-500" : "bg-emerald-500";
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
                        <div key={c.id} className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 space-y-1">
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
                  const Icon = severity === "red" || e.eventType === "tab_switch_paused" ? AlertCircle : severity === "yellow" ? AlertTriangle : CheckCircle;
                  const color = severity === "red" || e.eventType === "tab_switch_paused" ? "text-rose-500 bg-rose-500/10 border-rose-500/20" : severity === "yellow" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                  
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
  );
}
