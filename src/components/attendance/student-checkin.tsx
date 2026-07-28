"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Mic2,
  RadioTower,
  ShieldCheck,
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
  expectedHz: number;
  observedHz: number;
  detectedAt: number;
};

export function StudentCheckin({ session }: { session: Session }) {
  const [state, setState] = useState<"idle" | "working" | "success">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [required, setRequired] = useState(4);
  const [frequency, setFrequency] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const proofsRef = useRef<Proof[]>([]);
  const activeChallengeRef = useRef<{
    id: string;
    frequency: number;
    emittedAt: number;
    durationMs: number;
    matched: boolean;
  } | null>(null);

  function cleanup() {
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    void audioRef.current?.close();
  }

  useEffect(() => cleanup, []);

  async function submitEvidence(payload: Record<string, unknown>) {
    const response = await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Attendance could not be marked.");
    cleanup();
    setState("success");
    setMessage("Attendance marked successfully.");
    toast.success("You’re checked in", {
      description: `${session.classroom.name} attendance was verified.`,
    });
  }

  async function checkInWithLocation() {
    setState("working");
    setMessage("Getting a fresh high-accuracy location…");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        });
      });
      setMessage("Verifying your distance from the classroom…");
      await submitEvidence({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (error) {
      setState("idle");
      const detail =
        error instanceof Error
          ? error.message
          : "Location access was not available. Check browser permission and try again.";
      setMessage(detail);
      toast.error("Location check failed", { description: detail });
    }
  }

  async function startUltrasoundCheck() {
    setState("working");
    setMessage("Opening the live signal and microphone…");
    setProgress(0);
    proofsRef.current = [];

    try {
      const [ticketResponse, stream] = await Promise.all([
        fetch(`/api/realtime/ticket?sessionId=${session.id}`),
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        }),
      ]);
      const payload = await ticketResponse.json();
      if (!ticketResponse.ok) throw new Error(payload.error ?? "The live session is unavailable.");
      streamRef.current = stream;
      setRequired(payload.settings.matchesRequired ?? 4);

      const audio = new AudioContext();
      await audio.resume();
      audioRef.current = audio;
      const source = audio.createMediaStreamSource(stream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 32_768;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);

      const inspect = () => {
        analyser.getByteFrequencyData(bins);
        const challenge = activeChallengeRef.current;
        if (challenge && !challenge.matched) {
          const now = Date.now();
          if (
            now >= challenge.emittedAt - 120 &&
            now <= challenge.emittedAt + challenge.durationMs + 500
          ) {
            const center = Math.round(
              (challenge.frequency * analyser.fftSize) / audio.sampleRate,
            );
            let peakIndex = center;
            let peak = 0;
            for (
              let index = Math.max(0, center - 10);
              index <= Math.min(bins.length - 1, center + 10);
              index += 1
            ) {
              if (bins[index] > peak) {
                peak = bins[index];
                peakIndex = index;
              }
            }
            const observedHz = (peakIndex * audio.sampleRate) / analyser.fftSize;
            if (peak >= 32 && Math.abs(observedHz - challenge.frequency) <= 90) {
              challenge.matched = true;
              proofsRef.current.push({
                challengeId: challenge.id,
                expectedHz: challenge.frequency,
                observedHz,
                detectedAt: now,
              });
              const nextProgress = proofsRef.current.length;
              setProgress(nextProgress);
              setMessage(
                nextProgress >= (payload.settings.matchesRequired ?? 4)
                  ? "Signal sequence verified. Marking attendance…"
                  : `Live tone verified · ${nextProgress} of ${payload.settings.matchesRequired ?? 4}`,
              );
              if (nextProgress >= (payload.settings.matchesRequired ?? 4)) {
                void submitEvidence({ proofs: proofsRef.current }).catch((error) => {
                  setState("idle");
                  const detail =
                    error instanceof Error ? error.message : "Verification failed.";
                  setMessage(detail);
                  toast.error("Verification failed", { description: detail });
                });
                return;
              }
            }
          }
        }
        animationRef.current = requestAnimationFrame(inspect);
      };
      inspect();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/attendance`);
      socketRef.current = socket;
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
        const message = JSON.parse(event.data);
        if (message.type === "ready") {
          setMessage("Listening for the rotating classroom signal…");
        }
        if (message.type === "frequency") {
          setFrequency(message.frequency);
          activeChallengeRef.current = {
            id: message.id,
            frequency: message.frequency,
            emittedAt: message.emittedAt,
            durationMs: message.durationMs,
            matched: false,
          };
        }
      });
      socket.addEventListener("close", () => {
        if (proofsRef.current.length < (payload.settings.matchesRequired ?? 4)) {
          setState("idle");
          setMessage("The live signal disconnected. Please try again.");
        }
      });
    } catch (error) {
      cleanup();
      setState("idle");
      const detail =
        error instanceof Error
          ? error.message
          : "Microphone access is required for ultrasound verification.";
      setMessage(detail);
      toast.error("Ultrasound check failed", { description: detail });
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-3xl border border-emerald-700/12 bg-[#fbfaf5] p-7 text-center shadow-soft sm:p-10 dark:border-lime-300/10 dark:bg-[#151b18]">
        <span className="mx-auto grid size-17 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </span>
        <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
          You&apos;re checked in
        </h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-700">
          <ShieldCheck className="size-4" />
          Verified with {formatMethod(session.method)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/8 bg-[#fbfaf5] p-4 shadow-soft sm:p-6 dark:border-white/8 dark:bg-[#151b18]">
      <div className="text-center">
        <p className="mt-2 text-xs font-black tracking-[0.13em] text-slate-400 uppercase">
          {session.classroom.subjectCode}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
          {session.classroom.name}
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          {session.classroom.teacherName}
        </p>
      </div>

      <div className="mt-5">
        <PresenceVisualizer
          method={session.method}
          active={state === "working"}
          frequency={frequency}
          progress={progress}
          required={required}
        />
      </div>

      <div className="mt-4 rounded-2xl bg-black/[0.035] p-4 dark:bg-white/[0.045]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500">Verification method</span>
          <span className="font-black text-slate-800">{formatMethod(session.method)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500">Session status</span>
          <span className="inline-flex items-center gap-1.5 font-black text-emerald-600">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
      </div>

      {session.method === "ULTRASOUND" && state === "working" && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Frequency matches</span>
            <span>{progress}/{required}</span>
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
          {frequency && (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs font-extrabold text-violet-600">
              <RadioTower className="size-3.5" />
              Listening at {(frequency / 1_000).toFixed(1)} kHz
            </p>
          )}
        </div>
      )}

      {message && (
        <p
          className={cn(
            "mt-5 rounded-xl px-4 py-3 text-center text-xs font-bold",
            state === "working" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700",
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
          ? "Verifying…"
          : session.method === "GEOLOCATION"
            ? "Share location & check in"
            : "Enable microphone & listen"}
      </Button>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-[0.65rem] leading-5 font-semibold text-slate-400">
        <Check className="size-3.5 shrink-0 text-emerald-500" />
        {session.method === "GEOLOCATION"
          ? "Your exact coordinates are used only to verify this session."
          : "The microphone is analyzed on this device; raw audio is not uploaded."}
      </p>
    </div>
  );
}
