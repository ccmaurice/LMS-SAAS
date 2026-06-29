"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toCanvas } from "qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

type SetupStep = "welcome" | "room_scan" | "mobile_pair" | "complete";

function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return "Could not access camera or microphone.";
  let name = "";
  let msg = "";
  if (error instanceof Error) {
    name = error.name;
    msg = error.message;
  } else if (typeof error === "object" && error !== null) {
    name = (error as { name?: string }).name || "Error";
    msg = (error as { message?: string }).message || String(error);
  } else {
    name = String(error);
  }
  
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera/microphone permission was denied. Please click the camera icon in your browser address bar (or the lock/settings icon next to the URL), change the permission to 'Allow', and click 'Grant Camera Permission & Retry'.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera or microphone detected on your device. Please plug in a webcam/microphone or ensure they are enabled in your OS settings.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "SourceUnavailableError") {
    return "Your webcam or microphone is currently being used by another application (like Zoom, MS Teams, Skype, or another browser tab). Please close those programs and click 'Grant Camera Permission & Retry'.";
  }
  if (name === "OverconstrainedError") {
    return "The requested camera settings are not supported by your camera hardware. Simple resolution fallback will be attempted.";
  }
  if (name === "SecurityError") {
    return "Camera access is blocked because this page is served over an insecure context. HTTPS is required.";
  }
  return `Error accessing media devices (${name}): ${msg}`;
}

export function ProctoringSetupFlow({
  studentEmail,
  onComplete,
}: {
  _assessmentId?: string;
  studentEmail?: string;
  onComplete: (
    mobilePeerConnected: boolean,
    stream: MediaStream | null,
    mobileStream: MediaStream | null,
    pc: RTCPeerConnection | null
  ) => void;
}) {
  const [step, setStep] = useState<SetupStep>("welcome");
  
  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mobileStream, setMobileStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoMounted, setVideoMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Environment scan state
  const [roomScanCompleted, setRoomScanCompleted] = useState(false);
  
  // WebRTC & Mobile pairing state
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [mobileConnected, setMobileConnected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [activeInstructionTab, setActiveInstructionTab] = useState<"android" | "ios" | "desktop">("android");
  const mobileVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-detect user OS on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      if (/Android/i.test(ua)) {
        setActiveInstructionTab("android");
      } else if (/iPhone|iPad|iPod/i.test(ua)) {
        setActiveInstructionTab("ios");
      } else {
        setActiveInstructionTab("desktop");
      }
    }
  }, []);

  // Initialize webcam automatically on mount
  const startWebcam = useCallback(async () => {
    setCameraError(null);
    const ua = navigator.userAgent;
    const isChromeMobile = /Chrome/.test(ua) && /Android|iPhone|iPad|iPod/.test(ua);

    const constraintsQueue = isChromeMobile
      ? [
          { video: { facingMode: "user", width: { ideal: 640, max: 720 }, height: { ideal: 480, max: 480 } }, audio: true },
          { video: { facingMode: "user" }, audio: true },
          { video: true, audio: true },
          { video: true, audio: false },
        ]
      : [
          { video: { facingMode: "user" }, audio: true },
          { video: true, audio: true },
          { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true },
          { video: true, audio: false },
          { video: { facingMode: "user" }, audio: false },
        ];

    let success = false;
    let lastError: unknown = null;
    for (const constraints of constraintsQueue) {
      let attempts = 0;
      const maxAttempts = isChromeMobile ? 3 : 1;
      let stream: MediaStream | null = null;

      while (attempts < maxAttempts && !stream) {
        try {
          attempts++;
          console.info(`Attempt ${attempts} setup getUserMedia with constraints:`, constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          lastError = err;
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }

      if (stream) {
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        success = true;
        break;
      }
    }

    if (!success) {
      const msg = getFriendlyErrorMessage(lastError);
      setCameraError(msg);
    }
  }, []);





  // Callback ref to bind local webcam stream to video element immediately upon mounting
  const videoCallback = useCallback((el: HTMLVideoElement | null) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    videoRef.current = el;
    setVideoMounted(!!el);
  }, []);

  // Ensure stream is bound and plays when stream or video element becomes available
  useEffect(() => {
    if (videoRef.current && localStream) {
      const video = videoRef.current;
      if (video.srcObject !== localStream) {
        video.srcObject = localStream;
        video.muted = true;
        video.setAttribute("playsinline", "true");

        let playAttempts = 0;
        const tryPlay = () => {
          video.play().catch((err) => {
            console.warn(`Setup video play failed (attempt ${playAttempts}):`, err);
            playAttempts++;
            if (playAttempts < 3) {
              setTimeout(tryPlay, 200);
            }
          });
        };
        tryPlay();
      }
    }
  }, [localStream, videoMounted]);



  // Start polling/handshake for WebRTC
  const startWebrctNegotiation = useCallback((code: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      console.info("Desktop received mobile video track:", event.streams[0]);
      setMobileConnected(true);
      const stream = event.streams[0];
      setMobileStream(stream);
      if (mobileVideoRef.current) {
        mobileVideoRef.current.srcObject = stream;
      }
    };

    // Listen for connection candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void fetch("/api/proctor/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "candidate",
            code,
            role: "desktop",
            candidate: event.candidate,
          }),
        });
      }
    };

    // Poll for mobile offer / candidates
    let offerProcessed = false;
    const interval = setInterval(async () => {
      if (mobileConnected) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/proctor/signal?code=${code}&role=desktop`);
        if (!res.ok) return;
        const data = await res.json();

        // 1. Process SDP Offer from mobile
        if (data.sdp && data.sdp.type === "offer" && !offerProcessed) {
          offerProcessed = true;
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Send answer back to mobile
          await fetch("/api/proctor/signal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sdp",
              code,
              role: "desktop",
              sdp: answer,
            }),
          });
        }

        // 2. Add candidates from mobile
        if (data.candidates && data.candidates.length > 0) {
          for (const cand of data.candidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {
              // Ignore duplicate candidates
            }
          }
        }
      } catch (err) {
        console.error("Error polling signaling server:", err);
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      pc.close();
    };
  }, [mobileConnected]);

  // Generate pairing code & QR code
  const generatePairingCode = useCallback(async () => {
    try {
      const res = await fetch("/api/proctor/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await res.json();
      if (data.code) {
        setPairingCode(data.code);

        // Link studentEmail to the code on the signaling router
        if (studentEmail) {
          await fetch("/api/proctor/signal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "join", code: data.code, studentEmail }),
          }).catch(() => {});
        }
        
        // Draw QR code on canvas
        const mobileUrl = `${window.location.origin}/proctor/mobile?code=${data.code}`;
        if (canvasRef.current) {
          await toCanvas(canvasRef.current, mobileUrl, { width: 160, margin: 2 });
        }
        
        // Start polling for WebRTC negotiation
        startWebrctNegotiation(data.code);
      }
    } catch (err) {
      console.error("Failed to generate pairing code:", err);
    }
  }, [startWebrctNegotiation, studentEmail]);

  // Clean up
  useEffect(() => {
    if (step === "mobile_pair" && !pairingCode) {
      void generatePairingCode();
    }
    return () => {
      // Do not close peerConnection here since we hand it off to the parent TakeAssessment
    };
  }, [step, pairingCode, generatePairingCode]);

  return (
    <div className="surface-glass rounded-xl p-8 max-w-xl mx-auto border border-border shadow-md space-y-6 text-foreground">
      {cameraError && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 text-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-left">
              <h3 className="font-bold text-rose-500">Camera &amp; Mic Access Blocked</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {cameraError}. Since your browser has blocked camera/microphone access, follow these quick steps to unblock it so you can take your exam:
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-lg text-xs">
            <button
              onClick={() => setActiveInstructionTab("android")}
              className={`py-1.5 rounded-md font-semibold transition-all ${
                activeInstructionTab === "android"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Android (Chrome)
            </button>
            <button
              onClick={() => setActiveInstructionTab("ios")}
              className={`py-1.5 rounded-md font-semibold transition-all ${
                activeInstructionTab === "ios"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              iPhone (Safari)
            </button>
            <button
              onClick={() => setActiveInstructionTab("desktop")}
              className={`py-1.5 rounded-md font-semibold transition-all ${
                activeInstructionTab === "desktop"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Desktop
            </button>
          </div>

          {/* Instructions Content */}
          <div className="bg-background border border-border rounded-lg p-3 text-xs text-left space-y-3">
            {activeInstructionTab === "android" && (
              <ul className="space-y-2.5">
                <li className="flex gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <div>
                    <span className="font-semibold text-foreground">Chrome Site Settings:</span> Tap the <span className="font-semibold text-foreground">Lock/Sliders icon</span> on the left side of the address bar, select <span className="font-semibold text-foreground">Permissions</span>, and toggle <span className="font-semibold text-foreground">Camera</span> &amp; <span className="font-semibold text-foreground">Microphone</span> to <span className="font-semibold text-foreground">Allow</span>.
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <div>
                    <span className="font-semibold text-foreground">Android OS Permissions:</span> If still blocked, open your phone&apos;s <span className="font-semibold text-foreground">Settings</span> &rarr; <span className="font-semibold text-foreground">Apps</span> &rarr; <span className="font-semibold text-foreground">Chrome</span> &rarr; <span className="font-semibold text-foreground">Permissions</span>, and ensure <span className="font-semibold text-foreground">Camera</span> and <span className="font-semibold text-foreground">Microphone</span> are set to <span className="font-semibold text-foreground">Allow only while using the app</span>.
                  </div>
                </li>
              </ul>
            )}

            {activeInstructionTab === "ios" && (
              <ul className="space-y-2.5">
                <li className="flex gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <div>
                    <span className="font-semibold text-foreground">Safari/Chrome Settings:</span> Tap the <span className="font-semibold text-foreground">aA / Lock icon</span> in the address bar, tap <span className="font-semibold text-foreground">Website Settings</span>, and choose <span className="font-semibold text-foreground">Allow</span> for Camera &amp; Microphone.
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <div>
                    <span className="font-semibold text-foreground">iOS Settings Panel:</span> Open your iPhone&apos;s <span className="font-semibold text-foreground">Settings</span> app, scroll down to <span className="font-semibold text-foreground">Safari</span> (or <span className="font-semibold text-foreground">Chrome</span>), and verify both <span className="font-semibold text-foreground">Camera</span> and <span className="font-semibold text-foreground">Microphone</span> permissions are toggled <span className="font-semibold text-foreground">ON</span>.
                  </div>
                </li>
              </ul>
            )}

            {activeInstructionTab === "desktop" && (
              <ul className="space-y-2.5">
                <li className="flex gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <div>
                    <span className="font-semibold text-foreground">Address Bar Lock:</span> Click the <span className="font-semibold text-foreground">Lock icon</span> directly to the left of the website URL in the address bar.
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <div>
                    <span className="font-semibold text-foreground">Toggle Permissions:</span> Switch the <span className="font-semibold text-foreground">Camera</span> and <span className="font-semibold text-foreground">Microphone</span> selectors to <span className="font-semibold text-foreground">Allow</span>, and reload the page.
                  </div>
                </li>
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={() => void startWebcam()}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded text-xs w-full animate-in fade-in duration-300"
            >
              Grant Camera Permission &amp; Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => onComplete(false, null, null, null)}
              className="border-dashed border-rose-500/40 text-rose-600 hover:bg-rose-500/10 text-xs w-full"
            >
              Bypass Setup (For Testing &amp; Evaluators Only)
            </Button>
          </div>
        </div>
      )}
      {step === "welcome" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary">
            <Camera className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Secure Exam Proctoring Setup</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This exam requires proctoring monitoring. You will be guided through a webcam environment scan, ID verification, and mobile secondary camera pairing before beginning.
          </p>
          <Button 
            onClick={async () => {
              setStep("room_scan");
              await startWebcam();
            }} 
            className="w-full mt-4 font-bold"
          >
            Get Started
          </Button>
        </div>
      )}

      {step === "room_scan" && (
        <div className="space-y-4 text-center">
          <h2 className="text-lg font-semibold animate-in fade-in duration-300">
            Step 1: 360-Degree Room Scan
          </h2>
          <p className="text-xs text-muted-foreground animate-in fade-in duration-300">
            Slowly pan your webcam 360 degrees to show your physical test-taking space.
          </p>

          <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border">
            <video
              ref={videoCallback}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {roomScanCompleted && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-primary gap-2 animate-in fade-in duration-300">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold text-sm">Room Scan Confirmed</span>
              </div>
            )}
          </div>

          <div className="pt-1">
            {!roomScanCompleted ? (
              <Button
                onClick={() => setRoomScanCompleted(true)}
                className="w-full font-semibold"
                disabled={!!cameraError || !localStream}
              >
                Confirm Room Scan
              </Button>
            ) : (
              <Button
                onClick={() => setStep("mobile_pair")}
                className="w-full font-semibold"
                disabled={!!cameraError || !localStream}
              >
                Proceed to Mobile Pairing
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "mobile_pair" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-center">Step 2: Secondary Camera Pairing</h2>
          <p className="text-xs text-muted-foreground text-center">
            Scan the QR code with your mobile device or open the link to set up your keyboard & hands view.
          </p>
          <div className="flex flex-col md:flex-row gap-6 items-center justify-center py-2">
            <div className="border border-border p-2 rounded-lg bg-white">
              <canvas ref={canvasRef} className="w-40 h-40" />
            </div>
            <div className="space-y-2 text-center md:text-left">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Pairing Code</div>
              <div className="text-3xl font-extrabold tracking-widest text-primary font-mono">{pairingCode || "------"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center md:justify-start">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Waiting for connection...
              </div>
            </div>
          </div>
          
          {mobileConnected && (
            <div className="space-y-2 border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-3">
              <div className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Mobile View Streaming Established
              </div>
              <div className="aspect-video w-32 rounded overflow-hidden bg-black border border-border">
                <video ref={mobileVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => {
              onComplete(mobileConnected, localStream, mobileStream, peerConnectionRef.current);
            }} className="w-full bg-primary hover:bg-primary/90 font-bold" disabled={!mobileConnected}>
               Start Assessment (with Mobile Camera)
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                onComplete(false, localStream, null, null);
              }} 
              className="w-full border-dashed"
            >
              Skip Mobile Camera &amp; Start Exam
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
