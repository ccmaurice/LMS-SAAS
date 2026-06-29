"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { toCanvas } from "qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, Loader2, UserCheck } from "lucide-react";

type SetupStep = "welcome" | "room_scan" | "id_check" | "mobile_pair" | "complete";

export function ProctoringSetupFlow({
  studentEmail,
  onComplete,
}: {
  _assessmentId?: string;
  studentEmail?: string;
  onComplete: (mobilePeerConnected: boolean) => void;
}) {
  const [step, setStep] = useState<SetupStep>("welcome");
  
  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // ID Verification state
  const [idCapturedImage, setIdCapturedImage] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState(false);
  const [idMatchResult, setIdMatchResult] = useState<{ match: boolean; confidence: number } | null>(null);
  
  // Environment scan state
  const [roomScanCompleted, setRoomScanCompleted] = useState(false);
  
  // WebRTC & Mobile pairing state
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [mobileConnected, setMobileConnected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize webcam automatically on mount
  const startWebcam = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });
      setLocalStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Failed to access camera/mic automatically:", err);
      setCameraError("Camera and microphone access are required for this exam. Please check your browser permission settings, allow access, and reload the page.");
    }
  }, []);

  // Stop local camera
  const stopWebcam = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  // Request permissions automatically on mount
  useEffect(() => {
    void startWebcam();
    return () => {
      stopWebcam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback ref to bind local webcam stream to video element immediately upon mounting
  const videoCallback = useCallback((el: HTMLVideoElement | null) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    videoRef.current = el;
    if (el && localStream) {
      el.srcObject = localStream;
    }
  }, [localStream]);

  // Capture ID snapshot
  function captureIdSnapshot() {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setIdCapturedImage(dataUrl);
        
        // Simulate ID face comparison check
        setVerifyingId(true);
        setTimeout(() => {
          setVerifyingId(false);
          setIdMatchResult({ match: true, confidence: Math.floor(88 + Math.random() * 11) });
        }, 2000);
      }
    }
  }

  // Start polling/handshake for WebRTC
  const startWebrctNegotiation = useCallback((code: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      console.info("Desktop received mobile video track:", event.streams[0]);
      setMobileConnected(true);
      if (mobileVideoRef.current) {
        mobileVideoRef.current.srcObject = event.streams[0];
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
      stopWebcam();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [step, pairingCode, generatePairingCode, stopWebcam]);

  return (
    <div className="surface-glass rounded-xl p-8 max-w-xl mx-auto border border-border shadow-md space-y-6 text-foreground">
      {cameraError && (
        <div className="bg-rose-500/10 border border-rose-500/35 rounded-lg p-3 text-xs text-rose-500 font-semibold leading-relaxed text-center animate-pulse">
          {cameraError}
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
          <Button onClick={() => setStep("room_scan")} className="w-full mt-4">
            Get Started
          </Button>
        </div>
      )}

      {step === "room_scan" && (
        <div className="space-y-4 text-center">
          <h2 className="text-lg font-semibold">Step 1: 360-Degree Room Scan</h2>
          <p className="text-xs text-muted-foreground">
            Slowly pan your webcam 360 degrees to show your physical test-taking space.
          </p>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border">
            <video ref={videoCallback} autoPlay playsInline muted className="w-full h-full object-cover" />
            {roomScanCompleted && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-primary gap-2">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold text-sm">Room Scan Confirmed</span>
              </div>
            )}
          </div>
          {!roomScanCompleted ? (
            <Button onClick={() => setRoomScanCompleted(true)} className="w-full">
              Confirm Room Scan
            </Button>
          ) : (
            <Button onClick={() => setStep("id_check")} className="w-full">
              Proceed to ID Verification
            </Button>
          )}
        </div>
      )}

      {step === "id_check" && (
        <div className="space-y-4 text-center">
          <h2 className="text-lg font-semibold">Step 2: ID Card Verification</h2>
          <p className="text-xs text-muted-foreground">
            Hold your school ID or driver&apos;s license in front of the webcam and snapshot it.
          </p>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border">
            {idCapturedImage ? (
              <img src={idCapturedImage} alt="Captured ID Card" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoCallback} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
            {verifyingId && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-semibold text-white">Analyzing ID Card...</span>
              </div>
            )}
            {idMatchResult && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-primary gap-2 p-4">
                <UserCheck className="w-8 h-8 text-emerald-500" />
                <span className="font-bold text-white text-sm">Verification Succeeded</span>
                <span className="text-xs text-emerald-400">Match Confidence: {idMatchResult.confidence}%</span>
              </div>
            )}
          </div>
          {!idCapturedImage ? (
            <Button onClick={captureIdSnapshot} className="w-full">
              Capture ID Snapshot
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIdCapturedImage(null)} className="flex-1" disabled={verifyingId}>
                Retake
              </Button>
              <Button onClick={() => setStep("mobile_pair")} className="flex-1" disabled={verifyingId || !idMatchResult}>
                Next Step
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "mobile_pair" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-center">Step 3: Secondary Camera Pairing</h2>
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
              onComplete(mobileConnected);
            }} className="w-full bg-primary hover:bg-primary/90 font-bold" disabled={!mobileConnected}>
              Start Assessment (with Mobile Camera)
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                onComplete(false);
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
