"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, PhoneOff, Video } from "lucide-react";

function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return "Could not access camera.";
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
    return "Camera permission was denied. Please allow camera access in your mobile browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera detected on your device. Please ensure your device has a working camera.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "SourceUnavailableError") {
    return "Your camera is currently in use by another app. Please close other camera apps and try again.";
  }
  if (name === "SecurityError") {
    return "Camera access requires a secure connection (HTTPS).";
  }
  return `Error: ${msg || name}`;
}

function MobileBroadcastContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() || "";

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Streaming duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (broadcasting) {
      timer = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(timer);
  }, [broadcasting]);

  async function startBroadcast() {
    if (!code) {
      setError("Invalid or missing pairing code.");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      // 1. Get back-camera feed (with constraint cascade for maximum compatibility)
      const constraintsQueue = [
        { video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: { facingMode: "environment" }, audio: false },
        { video: true, audio: false },
      ];

      let mediaStream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const constraints of constraintsQueue) {
        try {
          console.info("Mobile attempting getUserMedia with constraints:", constraints);
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          console.warn("Mobile failed constraints:", constraints, err);
          lastError = err;
        }
      }

      if (!mediaStream) {
        throw lastError;
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // 2. Initialize Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      // Add tracks
      mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream));

      // Capture local ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void fetch("/api/proctor/signal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "candidate",
              code,
              role: "mobile",
              candidate: event.candidate,
            }),
          });
        }
      };

      // 3. Create WebRTC SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send SDP Offer to signaling router
      await fetch("/api/proctor/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sdp",
          code,
          role: "mobile",
          sdp: offer,
        }),
      });

      // 5. Poll for desktop answer
      let answerProcessed = false;
      const interval = setInterval(async () => {
        if (broadcasting) {
          clearInterval(interval);
          return;
        }
        try {
          const res = await fetch(`/api/proctor/signal?code=${code}&role=mobile`);
          if (!res.ok) return;
          const data = await res.json();

          // Apply SDP Answer
          if (data.sdp && data.sdp.type === "answer" && !answerProcessed) {
            answerProcessed = true;
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            setBroadcasting(true);
            setConnecting(false);
            clearInterval(interval);
          }

          // Apply ICE Candidates from desktop
          if (data.candidates && data.candidates.length > 0) {
            for (const cand of data.candidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {
                // Ignore duplicates
              }
            }
          }
        } catch (err) {
          console.error("Signaling handshake error:", err);
        }
      }, 1500);

    } catch (err: unknown) {
      console.error("Broadcast failed:", err);
      const friendlyMsg = getFriendlyErrorMessage(err);
      setError(friendlyMsg);
      setConnecting(false);
      stopBroadcast();
    }
  }

  function stopBroadcast() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setBroadcasting(false);
    setConnecting(false);
  }

  useEffect(() => {
    return () => stopBroadcast();
  }, []);

  // Periodic secondary mobile camera frame upload loop
  useEffect(() => {
    if (!broadcasting || !stream || !code) return;

    const interval = setInterval(() => {
      if (!videoRef.current) return;

      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Jpeg = canvas.toDataURL("image/jpeg", 0.5); // 50% compression
          void fetch("/api/proctor/signal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "upload_feed",
              code,
              secondaryFeed: base64Jpeg,
            }),
          }).catch(() => {});
        } catch (e) {
          console.error("Mobile frame upload failed:", e);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [broadcasting, stream, code]);

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6">
      {/* Header */}
      <div className="text-center py-4 border-b border-white/10">
        <h1 className="text-lg font-bold flex items-center justify-center gap-2">
          <Camera className="w-5 h-5 text-teal-400" />
          Proctor Desk View
        </h1>
        {code && (
          <p className="text-xs text-white/60 mt-1">
            Connected to Session: <span className="font-mono font-bold text-teal-400">{code}</span>
          </p>
        )}
      </div>

      {/* Main Viewport */}
      <div className="flex-1 my-6 relative aspect-[3/4] max-w-sm mx-auto w-full rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="text-center p-6 space-y-2">
            <Video className="w-12 h-12 text-white/20 mx-auto" />
            <p className="text-sm font-medium text-white/40">Camera stream inactive</p>
          </div>
        )}

        {/* Broadcasting badge */}
        {broadcasting && (
          <div className="absolute top-4 left-4 bg-rose-600/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            Live Broadcast
          </div>
        )}

        {connecting && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            <span className="text-xs font-semibold text-teal-300">Pairing with Desktop...</span>
          </div>
        )}
      </div>

      {/* Controls & Footer */}
      <div className="space-y-4 max-w-sm mx-auto w-full">
        {error && (
          <p className="text-xs text-rose-400 text-center bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
            {error}
          </p>
        )}

        {broadcasting && (
          <div className="text-center text-sm font-semibold tracking-wider text-teal-300">
            Stream duration: {formatTime(duration)}
          </div>
        )}

        {!broadcasting ? (
          <Button
            onClick={startBroadcast}
            disabled={connecting}
            className="w-full bg-teal-500 text-slate-950 font-semibold hover:bg-teal-400"
          >
            Start Broadcast
          </Button>
        ) : (
          <Button onClick={stopBroadcast} variant="destructive" className="w-full flex items-center justify-center gap-2">
            <PhoneOff className="w-4 h-4" />
            Disconnect Camera
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MobileBroadcastPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    }>
      <MobileBroadcastContent />
    </Suspense>
  );
}
