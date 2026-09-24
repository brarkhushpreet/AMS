"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AudioLines,
  Clock3,
  LocateFixed,
  LoaderCircle,
  MapPin,
  RadioTower,
  Square,
  Volume2,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { SelectField } from "@/components/ui/select-field";
import { StatusPill } from "@/components/ui/status-pill";
import { PresenceVisualizer } from "@/components/attendance/presence-visualizer";
import { cn, formatMethod } from "@/lib/utils";

type ActiveSession = {
  id: string;
  method: "GEOLOCATION" | "ULTRASOUND";
  endsAt: string;
  radiusMeters: number | null;
};

export function SessionControl({
  classroomId,
  activeSession,
}: {
  classroomId: string;
  activeSession: ActiveSession | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"GEOLOCATION" | "ULTRASOUND">("GEOLOCATION");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function start(formData: FormData) {
    setPending(true);
    setError("");
    let coordinates: GeolocationCoordinates | null = null;

    if (method === "GEOLOCATION") {
      try {
        coordinates = await new Promise<GeolocationCoordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            reject,
            { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
          );
        });
      } catch {
        setPending(false);
        const message = "Allow precise location access to set the classroom center.";
        setError(message);
        toast.error("Location permission needed", { description: message });
        return;
      }
    }

    try {
    const response = await fetch("/api/attendance/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classroomId,
        method,
        durationMinutes: Number(formData.get("durationMinutes")),
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        radiusMeters:
          method === "GEOLOCATION" ? Number(formData.get("radiusMeters")) : undefined,
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      const message = payload.error ?? "Could not start attendance.";
      setError(message);
      toast.error("Session could not start", { description: message });
      return;
    }
    toast.success("Attendance is live", {
      description: `${formatMethod(method)} verification has started.`,
    });
    router.refresh();
    } catch {
      setError("Connection lost. Check your connection and try again.");
      toast.error("Could not reach the server");
    } finally { setPending(false); }
  }

  if (activeSession) {
    return (
      <LiveSessionCard
        session={activeSession}
        onClosed={() => router.refresh()}
        onOpenReceipt={(sessionId) =>
          router.push(`/dashboard/sessions/${sessionId}/receipt`)
        }
      />
    );
  }

  return (
    <form action={start} className="rounded-xl border border-black/8 bg-[var(--surface)] p-5 shadow-card sm:p-6 dark:border-white/8 dark:bg-[var(--surface)]">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <RadioTower className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold text-slate-950">Start attendance</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Choose the right presence check for this session.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MethodButton
          active={method === "GEOLOCATION"}
          onClick={() => setMethod("GEOLOCATION")}
          icon={MapPin}
          title="Location"
          detail="Fast & flexible"
          tone="blue"
        />
        <MethodButton
          active={method === "ULTRASOUND"}
          onClick={() => setMethod("ULTRASOUND")}
          icon={Waves}
          title="Ultrasound"
          detail="Stricter presence"
          tone="violet"
        />
      </div>

      <div className="mt-4">
        <PresenceVisualizer method={method} compact />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="durationMinutes">Check-in window</Label>
          <SelectField
            id="durationMinutes"
            name="durationMinutes"
            defaultValue="5"
            options={[
              { value: "2", label: "2 minutes", description: "Quick pulse check" },
              { value: "5", label: "5 minutes", description: "Recommended" },
              { value: "10", label: "10 minutes", description: "Large classroom" },
              { value: "15", label: "15 minutes", description: "Extended window" },
            ]}
          />
        </div>
        {method === "GEOLOCATION" ? (
          <div>
            <Label htmlFor="radiusMeters">Allowed radius</Label>
            <SelectField
              id="radiusMeters"
              name="radiusMeters"
              defaultValue="40"
              options={[
                { value: "20", label: "20 m", description: "Small room" },
                { value: "40", label: "40 m", description: "Standard classroom" },
                { value: "75", label: "75 m", description: "Lecture hall" },
                { value: "150", label: "150 m", description: "Outdoor session" },
              ]}
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="tonePattern">Tone pattern</Label>
            <Input id="tonePattern" value="17.2–18.8 kHz · rotating" disabled />
          </div>
        )}
      </div>

      <div
        className={cn(
          "mt-5 rounded-xl border p-3 text-xs leading-5",
          method === "GEOLOCATION"
            ? "border-cyan-700/10 bg-cyan-300/12 text-cyan-800 dark:border-cyan-300/10 dark:text-cyan-300"
            : "border-violet-700/10 bg-violet-300/12 text-violet-800 dark:border-violet-300/10 dark:text-violet-300",
        )}
      >
        {method === "GEOLOCATION"
          ? "Your current location becomes the room center. Students must share a fresh reading inside the chosen radius."
          : "Keep this page open on the classroom audio device. The signal hops to a new frequency about every second."}
      </div>

      <Button type="submit" variant="brand" size="lg" className="mt-5 w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RadioTower className="size-4" />}
        {pending ? "Starting session…" : `Start ${formatMethod(method)} session`}
      </Button>
    </form>
  );
}

function MethodButton({
  active,
  onClick,
  icon: Icon,
  title,
  detail,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MapPin;
  title: string;
  detail: string;
  tone: "blue" | "violet";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left",
        active
          ? tone === "blue"
            ? "border-cyan-500 bg-cyan-300/12 ring-2 ring-cyan-500/10"
            : "border-violet-500 bg-violet-300/12 ring-2 ring-violet-500/10"
          : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl",
          tone === "blue"
            ? "bg-cyan-300/25 text-cyan-800 dark:text-cyan-300"
            : "bg-violet-300/25 text-violet-800 dark:text-violet-300",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        <span className="block text-[0.65rem] font-semibold text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function LiveSessionCard({
  session,
  onClosed,
  onOpenReceipt,
}: {
  session: ActiveSession;
  onClosed: () => void;
  onOpenReceipt: (sessionId: string) => void;
}) {
  const [remaining, setRemaining] = useState("");
  const [closing, setClosing] = useState(false);
  const [signalRunning, setSignalRunning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [signalError, setSignalError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const clockOffsetRef = useRef(0);
  const [distributed, setDistributed] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => {
      const milliseconds = Math.max(0, new Date(session.endsAt).getTime() - Date.now());
      const minutes = Math.floor(milliseconds / 60_000);
      const seconds = Math.floor((milliseconds % 60_000) / 1_000);
      setRemaining(`${minutes}:${String(seconds).padStart(2, "0")}`);
    };
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [session.endsAt]);

  useEffect(
    () => () => {
      socketRef.current?.close();
      void audioRef.current?.close();
    },
    [],
  );

  async function startSignal() {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) return;
    if (connecting) return;
    setConnecting(true);
    setSignalError("");
    try {
      const ticketResponse = await fetch(`/api/realtime/ticket?sessionId=${session.id}`);
      const payload = await ticketResponse.json();
      if (!ticketResponse.ok) throw new Error(payload.error ?? "Could not open the live channel.");

      const AudioContextClass = window.AudioContext;
      const audio = new AudioContextClass();
      audioRef.current = audio;
      await audio.resume();

      const socket = new WebSocket(payload.websocketUrl);
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
          clockOffsetRef.current = Number(message.serverTime ?? Date.now()) - Date.now();
          setDistributed(Boolean(message.distributedCoordinator));
          setSignalRunning(true);
          setConnecting(false);
        }
        if ((message.type === "coordinator" && !message.available) || (message.type === "ready" && message.coordinatorUnavailable)) {
          setFrequency(null); setSignalError("The room signal is paused while its connection recovers."); return;
        }
        if (message.type === "ready") {
          clockOffsetRef.current =
            Number(message.serverTime ?? Date.now()) - Date.now();
          setDistributed(Boolean(message.distributedCoordinator));
          setSignalRunning(true);
          toast.success("Room signal connected", {
            description:
              "Waiting for the next scheduled tone.",
          });
        }
        if (message.type !== "frequency") return;
        setSignalError("");
        setFrequency(message.frequency);

        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = message.frequency;
        oscillator.connect(gain);
        gain.connect(audio.destination);

        const delay = Math.max(
          0.02,
          (message.emittedAt -
            (Date.now() + clockOffsetRef.current)) /
            1_000,
        );
        const startsAt = audio.currentTime + delay;
        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(0.035, startsAt + 0.025);
        gain.gain.setValueAtTime(0.035, startsAt + message.durationMs / 1_000 - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + message.durationMs / 1_000);
        oscillator.start(startsAt);
        oscillator.stop(startsAt + message.durationMs / 1_000 + 0.02);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
      socket.addEventListener("close", () => {
        setSignalRunning(false); setConnecting(false); setFrequency(null);
        if (audio.state !== "closed") void audio.close();
      });
      socket.addEventListener("error", () => {
        setSignalError("The room connection was interrupted. Try starting the signal again.");
        socket.close();
      });
    } catch (error) {
      setConnecting(false);
      socketRef.current?.close();
      if (audioRef.current && audioRef.current.state !== "closed") void audioRef.current.close();
      const message =
        error instanceof Error ? error.message : "The signal could not start.";
      setSignalError(message);
      toast.error("Signal could not start", { description: message });
    }
  }

  async function closeSession() {
    setClosing(true);
    try {
    const response = await fetch(`/api/attendance/sessions/${session.id}/close`, {
      method: "POST",
    });
    if (!response.ok) {
      setClosing(false);
      toast.error("Could not end attendance");
      return;
    }
    const result = await response.json();
    socketRef.current?.close();
    if (audioRef.current && audioRef.current.state !== "closed") await audioRef.current.close();
    setClosing(false);
    toast.success("Attendance ended", {
      description:
        "The session was closed and its audit chain was cryptographically sealed.",
      action: result.reportId
        ? {
            label: "View receipt",
            onClick: () => onOpenReceipt(session.id),
          }
        : undefined,
    });
    onClosed();
    } catch {
      toast.error("Connection lost. Refresh to check whether the session ended.");
    } finally { setClosing(false); }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-700/12 bg-[var(--surface)] shadow-card dark:border-blue-300/10 dark:bg-[var(--surface)]">
      <div className="bg-[#151a17] px-5 py-4 text-white dark:bg-[#101513]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/15">
              {session.method === "ULTRASOUND" ? <Waves className="size-5" /> : <LocateFixed className="size-5" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Attendance is live</h3>
                <StatusPill tone="green" pulse>Active</StatusPill>
              </div>
              <p className="mt-1 text-xs font-semibold text-white/42">
                {formatMethod(session.method)} verification
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-center">
            <p className="font-mono text-lg font-semibold">{remaining}</p>
            <p className="text-[0.58rem] font-bold text-emerald-50">remaining</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <PresenceVisualizer
          method={session.method}
          active
          frequency={frequency}
        />
        {session.method === "ULTRASOUND" ? (
          <>
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-violet-300/12 p-4 dark:bg-violet-300/7">
              <span className={cn("grid size-11 place-items-center rounded-2xl bg-violet-600 text-white", signalRunning && "animate-pulse-soft")}>
                <AudioLines className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {signalRunning && frequency ? "Room signal is playing" : signalRunning ? "Waiting for the next room signal" : "Start the classroom speaker"}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {frequency ? `${(frequency / 1_000).toFixed(1)} kHz now · hidden from student clients` : "Use a classroom speaker for better coverage."}
                </p>
              </div>
              {signalRunning && (
                <div className="flex h-7 items-center gap-1" aria-hidden="true">
                  {[3, 6, 4, 8, 5].map((height, index) => (
                    <span
                      key={index}
                      className="w-1 animate-pulse rounded-full bg-violet-500"
                      style={{ height: `${height * 3}px`, animationDelay: `${index * 90}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
            {signalError && <p className="mt-3 text-xs font-bold text-red-600">{signalError}</p>}
            {!signalRunning && (
              <Button type="button" variant="secondary" className="mt-4 w-full" onClick={startSignal} disabled={connecting}>
                <Volume2 className="size-4" />
                {connecting ? "Connecting…" : "Start room signal"}
              </Button>
            )}
            {signalRunning && distributed !== null && (
              <p className="mt-3 flex items-center justify-center gap-2 text-[0.65rem] font-bold text-slate-500 dark:text-white/60">
                <RadioTower className="size-3.5" />
                {distributed
                  ? "Room connection established"
                  : "Local room connection"}
              </p>
            )}
          </>
        ) : (
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-cyan-300/12 p-4 dark:bg-cyan-300/7">
            <span className="grid size-11 place-items-center rounded-2xl bg-cyan-500 text-slate-950">
              <LocateFixed className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Classroom radius is active</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Students within {session.radiusMeters ?? 40} m can check in.
              </p>
            </div>
          </div>
        )}
        <Button type="button" variant="danger" className="mt-4 w-full" onClick={closeSession} disabled={closing}>
          {closing ? <LoaderCircle className="size-4 animate-spin" /> : <Square className="size-3.5 fill-current" />}
          {closing ? "Ending session…" : "End attendance"}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.65rem] font-semibold text-slate-500">
          <Clock3 className="size-3" />
          The session closes automatically when the timer reaches zero.
        </p>
      </div>
    </div>
  );
}
