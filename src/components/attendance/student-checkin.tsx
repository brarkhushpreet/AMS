"use client";

import { useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Fingerprint,
  LoaderCircle,
  MapPin,
  Mic2,
  RadioTower,
  ShieldCheck,
  SignalHigh,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresenceVisualizer } from "@/components/attendance/presence-visualizer";
import { cn, formatMethod } from "@/lib/utils";

type Session = {
  id: string;
  method: "GEOLOCATION" | "ULTRASOUND";
  endsAt: string;
  classroom: {
    name: string;
    subjectCode: string;
    teacherName: string;
  };
};

type Proof = {
  challengeId: string;
  observedHz: number;
  detectedAt: number;
  signalToNoiseDb: number;
  amplitude: number;
};

type SpectralPeak = {
  observedHz: number;
  signalToNoiseDb: number;
  amplitude: number;
  detectedAt: number;
};

type ChallengeWindow = {
  id: string;
  emittedAt: number;
  durationMs: number;
  best: SpectralPeak | null;
};

export function StudentCheckin({ session }: { session: Session }) {
  const [state, setState] = useState<"idle" | "working" | "success">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [required, setRequired] = useState(5);
  const [signalQuality, setSignalQuality] = useState<number | null>(
    null,
  );
  const [deviceBound, setDeviceBound] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const challengeTimerRef = useRef<number | null>(null);
  const proofsRef = useRef<Proof[]>([]);
  const activeWindowRef = useRef<ChallengeWindow | null>(null);
  const submittingRef = useRef(false);
  const completedRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const captureTimeoutRef = useRef<number | null>(null);

  function cleanup() {
    if (captureTimeoutRef.current) window.clearTimeout(captureTimeoutRef.current);
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (challengeTimerRef.current) {
      window.clearTimeout(challengeTimerRef.current);
    }
    if (audioRef.current?.state !== "closed") void audioRef.current?.close();
    audioRef.current = null;
    streamRef.current = null;
    socketRef.current = null;
    activeWindowRef.current = null;
  }

  useEffect(() => cleanup, []);

  async function submitEvidence(payload: Record<string, unknown>) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error ?? "Attendance could not be marked.",
        );
      }

      let boundToDevice = false;
      if (result.requiresPasskey) {
        setMessage(
          "Presence verified. Confirm this check-in with your device…",
        );
        const assertion = await startAuthentication(
          result.authenticationOptions,
        );
        const deviceResponse = await fetch(
          "/api/attendance/verify-device",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              verificationId: result.verificationId,
              response: assertion,
            }),
          },
        );
        const deviceResult = await deviceResponse.json();
        if (!deviceResponse.ok) {
          throw new Error(
            deviceResult.error ?? "Device confirmation failed.",
          );
        }
        boundToDevice = true;
      }

      completedRef.current = true;
      cleanup();
      setDeviceBound(boundToDevice);
      setState("success");
      setMessage(
        boundToDevice
          ? "Presence and your registered passkey were verified."
          : "Presence was verified successfully.",
      );
      toast.success("You’re checked in", {
        description: boundToDevice
          ? `${session.classroom.name} was verified with a passkey confirmation.`
          : `${session.classroom.name} attendance was verified.`,
      });
    } finally {
      submittingRef.current = false;
    }
  }

  async function checkInWithLocation() {
    setState("working");
    setMessage("Getting a fresh high-accuracy location…");
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15_000,
            maximumAge: 0,
          });
        },
      );
      setMessage("Verifying your distance from the classroom…");
      await submitEvidence({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (error) {
      if (!completedRef.current) setState("idle");
      const detail =
        error instanceof Error
          ? error.message
          : "Location access was unavailable. Check browser permission and try again.";
      setMessage(detail);
      toast.error("Location check failed", { description: detail });
    }
  }

  function finishChallengeWindow(captureTarget: number) {
    const window = activeWindowRef.current;
    activeWindowRef.current = null;
    if (
      !window?.best ||
      window.best.signalToNoiseDb < 4.5 ||
      window.best.amplitude < 0.00035
    ) {
      setMessage(
        "A challenge passed without a clear signal. Keep the microphone near the room speaker…",
      );
      return;
    }

    proofsRef.current.push({
      challengeId: window.id,
      observedHz: window.best.observedHz,
      detectedAt: window.best.detectedAt,
      signalToNoiseDb: window.best.signalToNoiseDb,
      amplitude: window.best.amplitude,
    });
    const captured = proofsRef.current.length;
    setProgress(captured);
    setSignalQuality(window.best.signalToNoiseDb);
    setMessage(
      captured >= captureTarget
        ? "Hidden sequence captured. Verifying it with the server…"
        : `Acoustic symbol captured · ${captured} of ${captureTarget}`,
    );
    if (captured >= captureTarget) {
      void submitEvidence({ proofs: proofsRef.current }).catch(
        (error) => {
          cleanup();
          if (!completedRef.current) setState("idle");
          const detail =
            error instanceof Error
              ? error.message
              : "Verification failed.";
          setMessage(detail);
          toast.error("Verification failed", {
            description: detail,
          });
        },
      );
    }
  }

  async function startUltrasoundCheck() {
    setState("working");
    setMessage("Opening the secure audio detector and microphone…");
    setProgress(0);
    setSignalQuality(null);
    proofsRef.current = [];
    submittingRef.current = false;
    completedRef.current = false;

    try {
      const ticketResponse = await fetch(`/api/realtime/ticket?sessionId=${session.id}`);
      const payload = await ticketResponse.json();
      if (!ticketResponse.ok) {
        throw new Error(
          payload.error ?? "The live session is unavailable.",
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      } });
      streamRef.current = stream;
      const matchesRequired = payload.settings.matchesRequired ?? 4;
      const captureTarget = Math.min(12, matchesRequired + 1);
      setRequired(captureTarget);

      const audio = new AudioContext();
      audioRef.current = audio;
      await audio.resume();
      if (
        audio.sampleRate / 2 <
        (payload.settings.maxHz ?? 18_800) + 150
      ) {
        throw new Error(
          `This device’s ${audio.sampleRate} Hz audio mode cannot analyze the classroom signal band.`,
        );
      }
      await audio.audioWorklet.addModule(
        "/audio/presence-detector.worklet.js",
      );
      const source = audio.createMediaStreamSource(stream);
      const detector = new AudioWorkletNode(
        audio,
        "presence-detector",
      );
      const silentOutput = audio.createGain();
      silentOutput.gain.value = 0;
      source.connect(detector);
      detector.connect(silentOutput);
      silentOutput.connect(audio.destination);
      detector.port.postMessage({
        type: "configure",
        minimumHz: payload.settings.minHz ?? 17_200,
        maximumHz: payload.settings.maxHz ?? 18_800,
        stepHz: 100,
      });
      detector.port.onmessage = (event) => {
        if (event.data?.type === "unsupported_sample_rate") {
          setMessage(
            "This microphone sample rate cannot analyze the selected ultrasonic band.",
          );
          return;
        }
        if (event.data?.type !== "spectral_peak") return;
        const activeWindow = activeWindowRef.current;
        if (!activeWindow) return;
        const detectedAt = Date.now() + clockOffsetRef.current;
        if (
          detectedAt < activeWindow.emittedAt - 180 ||
          detectedAt >
            activeWindow.emittedAt +
              activeWindow.durationMs +
              380
        ) {
          return;
        }
        const peak: SpectralPeak = {
          observedHz: event.data.observedHz,
          signalToNoiseDb: event.data.signalToNoiseDb,
          amplitude: event.data.amplitude,
          detectedAt,
        };
        if (
          !activeWindow.best ||
          peak.signalToNoiseDb >
            activeWindow.best.signalToNoiseDb
        ) {
          activeWindow.best = peak;
          setSignalQuality(peak.signalToNoiseDb);
        }
      };

      const socket = new WebSocket(payload.websocketUrl);
      socketRef.current = socket;
      captureTimeoutRef.current = window.setTimeout(() => {
        if (!completedRef.current && !submittingRef.current) {
          cleanup(); setState("idle");
          setMessage("No complete room signal was received. Check the speaker or try Equipment check before listening again.");
        }
      }, 30000);
      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            sessionId: session.id,
            ticket: payload.ticket,
          }),
        );
      });
      socket.addEventListener("message", (event) => {
        const liveMessage = JSON.parse(event.data);
        if (liveMessage.type === "coordinator" && !liveMessage.available || liveMessage.type === "ready" && liveMessage.coordinatorUnavailable) {
          cleanup(); setState("idle"); setMessage("The room signal is temporarily unavailable. Please try again shortly."); return;
        }
        if (liveMessage.type === "ready") {
          clockOffsetRef.current =
            Number(liveMessage.serverTime ?? Date.now()) -
            Date.now();
          setMessage(
            "Listening for server-hidden classroom challenges…",
          );
        }
        if (liveMessage.type !== "challenge_window") return;
        if (challengeTimerRef.current) {
          window.clearTimeout(challengeTimerRef.current);
          finishChallengeWindow(captureTarget);
        }
        activeWindowRef.current = {
          id: liveMessage.id,
          emittedAt: liveMessage.emittedAt,
          durationMs: liveMessage.durationMs,
          best: null,
        };
        const finishesIn = Math.max(
          50,
          liveMessage.emittedAt +
            liveMessage.durationMs +
            320 -
            (Date.now() + clockOffsetRef.current),
        );
        challengeTimerRef.current = window.setTimeout(
          () => finishChallengeWindow(captureTarget),
          finishesIn,
        );
      });
      socket.addEventListener("close", () => {
        if (!completedRef.current && !submittingRef.current) {
          setState("idle");
          setMessage(
            "The live signal disconnected. Ask the teacher to keep the emitter open and try again.",
          );
        }
      });
    } catch (error) {
      cleanup();
      setState("idle");
      const detail =
        error instanceof Error
          ? error.message
          : "Microphone access is required for acoustic verification.";
      setMessage(detail);
      toast.error("Acoustic check failed", {
        description: detail,
      });
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-3xl border border-emerald-700/12 bg-[var(--surface)] p-7 text-center shadow-soft sm:p-10 dark:border-blue-300/10 dark:bg-[var(--surface)]">
        <span className="mx-auto grid size-17 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-blue-300/10 dark:text-blue-300">
          <CheckCircle2 className="size-8" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          You&apos;re checked in
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-white/60">
          {message}
        </p>
        <div className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 dark:bg-blue-300/8 dark:text-blue-300">
          {deviceBound ? (
            <Fingerprint className="size-4" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {deviceBound
            ? `Passkey-confirmed ${formatMethod(session.method)} proof`
            : `Verified with ${formatMethod(session.method)}`}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/8 bg-[var(--surface)] p-4 shadow-soft sm:p-6 dark:border-white/8 dark:bg-[var(--surface)]">
      <div className="text-center">
        <p className="mt-2 text-xs font-semibold tracking-[0.13em] text-slate-500 uppercase dark:text-white/60">
          {session.classroom.subjectCode}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {session.classroom.name}
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-white/60">
          {session.classroom.teacherName}
        </p>
      </div>

      <div className="mt-5">
        <PresenceVisualizer
          method={session.method}
          active={state === "working"}
          progress={progress}
          required={required}
        />
      </div>

      <div className="mt-4 rounded-2xl bg-black/[0.035] p-4 dark:bg-white/[0.045]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500 dark:text-white/60">
            Verification method
          </span>
          <span className="font-semibold text-slate-800 dark:text-white/80">
            {formatMethod(session.method)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500 dark:text-white/60">
            Protocol
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-blue-300">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-lime-300" />
            Live room check
          </span>
        </div>
      </div>

      {session.method === "ULTRASOUND" &&
        state === "working" && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-white/60">
              <span>Captured symbols</span>
              <span>
                {progress}/{required}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {Array.from({ length: required }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2 flex-1 rounded-full",
                    index < progress
                      ? "bg-violet-500"
                      : "bg-slate-100 dark:bg-white/8",
                  )}
                />
              ))}
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-300">
              {signalQuality === null ? (
                <RadioTower className="size-3.5 animate-pulse" />
              ) : (
                <SignalHigh className="size-3.5" />
              )}
              {signalQuality === null
                ? "Scanning the hidden frequency band"
                : `${signalQuality.toFixed(1)} dB signal separation`}
            </p>
          </div>
        )}

      {message && (
        <p
          className={cn(
            "mt-5 rounded-xl px-4 py-3 text-center text-xs font-bold",
            state === "working"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-300/8 dark:text-blue-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-300/8 dark:text-amber-300",
          )}
        >
          {message}
        </p>
      )}

      <Button
        type="button"
        variant="brand"
        size="lg"
        className="mt-6 w-full"
        disabled={state === "working"}
        onClick={
          session.method === "GEOLOCATION"
            ? checkInWithLocation
            : startUltrasoundCheck
        }
      >
        {state === "working" ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : session.method === "GEOLOCATION" ? (
          <MapPin className="size-4" />
        ) : (
          <Mic2 className="size-4" />
        )}
        {state === "working"
          ? "Building presence proof…"
          : session.method === "GEOLOCATION"
            ? "Share location & check in"
            : "Enable secure audio detector"}
      </Button>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-[0.65rem] leading-5 font-semibold text-slate-500 dark:text-white/60">
        <Check className="size-3.5 shrink-0 text-emerald-500" />
        {session.method === "GEOLOCATION"
          ? "Coordinates are reduced to distance and accuracy evidence before storage."
          : "Expected frequencies never reach this client; raw microphone audio never leaves the device."}
      </p>
    </div>
  );
}
