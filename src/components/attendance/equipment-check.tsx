"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Mic, Square, Volume2, Check, CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const frequencies = Array.from({ length: 17 }, (_, index) => 17200 + index * 100);
type Reading = { observedHz: number; signalToNoiseDb: number; amplitude: number; sampleRate: number };

export function EquipmentCheck({ role }: { role: "TEACHER" | "STUDENT" }) {
  const [mode, setMode] = useState<"idle" | "speaker" | "microphone">("idle");
  const [readings, setReadings] = useState<Record<number, Reading>>({});
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const starting = useRef(false);

  function cleanup() {
    if (timer.current) clearTimeout(timer.current);
    if (ticker.current) clearInterval(ticker.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (audio.current && audio.current.state !== "closed") void audio.current.close();
    audio.current = null;
  }
  useEffect(() => cleanup, []);
  function stop() { cleanup(); setMode("idle"); setCurrent(null); }

  async function start(kind: "speaker" | "microphone") {
    if (starting.current) return;
    starting.current = true;
    cleanup(); setError(""); setFinished(false); setReadings({});
    setMode(kind);
    try {
      if (!window.isSecureContext) throw new Error("Use HTTPS or localhost for microphone access.");
      const context = new AudioContext();
      audio.current = context;
      await context.resume();
      if (audio.current !== context) return;
      if (kind === "speaker") {
        const startAt = context.currentTime + .2;
        for (let index = 0; index < 51; index++) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const time = startAt + index * .5;
          oscillator.frequency.value = frequencies[index % 17];
          oscillator.connect(gain); gain.connect(context.destination);
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(.025, time + .03);
          gain.gain.setValueAtTime(.025, time + .35);
          gain.gain.linearRampToValueAtTime(0, time + .4);
          oscillator.start(time); oscillator.stop(time + .42);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        }
        ticker.current = setInterval(() => setCurrent(frequencies[Math.max(0, Math.floor((context.currentTime - startAt) / .5)) % 17]), 100);
        timer.current = setTimeout(() => { stop(); toast.success("Test sequence finished"); }, 26000);
      } else {
        const captured = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (audio.current !== context) { captured.getTracks().forEach(track => track.stop()); return; }
        stream.current = captured;
        await context.audioWorklet.addModule("/audio/presence-detector.worklet.js");
        if (audio.current !== context) return;
        const source = context.createMediaStreamSource(stream.current);
        const detector = new AudioWorkletNode(context, "presence-detector");
        const mute = context.createGain(); mute.gain.value = 0;
        source.connect(detector); detector.connect(mute); mute.connect(context.destination);
        detector.port.onmessage = ({ data }) => {
          if (data.type === "unsupported_sample_rate") { setError("This device’s audio sample rate cannot capture the test band."); stop(); return; }
          if (data.type !== "spectral_peak" || data.signalToNoiseDb < 4.5 || data.amplitude < .00035) return;
          const reading = data as Reading;
          setCurrent(reading.observedHz);
          setReadings(previous => ({ ...previous, [reading.observedHz]: !previous[reading.observedHz] || previous[reading.observedHz].signalToNoiseDb < reading.signalToNoiseDb ? reading : previous[reading.observedHz] }));
        };
        timer.current = setTimeout(() => { stop(); setFinished(true); }, 12000);
      }
    } catch (cause) { stop(); setError(cause instanceof Error ? cause.message : "Could not access the audio device."); }
    finally { starting.current = false; }
  }

  function download() {
    const artifact = { schema: "classpulse.equipment-check.v1", generatedAt: new Date().toISOString(), kind: "local-diagnostic-not-attendance", frequencies, observed: Object.values(readings), missing: frequencies.filter(hz => !readings[hz]) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "classpulse-equipment-check.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.3fr]">
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"><h3 className="font-semibold">A quick room check</h3><ol className="mt-5 space-y-4 text-sm leading-6 text-[var(--muted)]"><li>1. Start the test sequence on the classroom speaker at a comfortable volume.</li><li>2. Open this screen on a different device. Listen from a typical seat for 12 seconds.</li><li>3. Review the received frequencies. Try several seats before choosing acoustic attendance.</li></ol><div className="mt-6 flex flex-wrap gap-2"><Button variant={role === "TEACHER" ? "brand" : "secondary"} onClick={() => start("speaker")} disabled={mode !== "idle"}><Volume2 className="size-4" /> Play test sequence</Button><Button variant={role === "STUDENT" ? "brand" : "secondary"} onClick={() => start("microphone")} disabled={mode !== "idle"}><Mic className="size-4" /> Listen for 12 seconds</Button>{mode !== "idle" && <Button variant="ghost" onClick={stop}><Square className="size-3.5" /> Stop</Button>}</div><p className="mt-5 text-xs leading-5 text-[var(--muted)]">Some people can hear this high-frequency band. Stop if it is uncomfortable. Microphone audio stays on this device.</p>{error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>}</section>
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"><div className="flex items-center justify-between gap-4"><h3 className="font-semibold">Reception across the frequency band</h3><span className="font-mono text-xs text-[var(--muted)]">{Object.keys(readings).length} / 17</span></div><p aria-live="polite" className="mt-2 min-h-6 text-sm text-[var(--muted)]">{mode === "speaker" ? "Playing three sweeps · " + (current ? (current / 1000).toFixed(1) + " kHz" : "starting") : mode === "microphone" ? "Listening. Keep this tab open and near the speaker." : finished ? Object.keys(readings).length === 17 ? "All test frequencies received. Test at other seats as well." : "Some frequencies were not received. Check the speaker, distance, or microphone settings." : "Run a microphone check to see results here."}</p><div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6">{frequencies.map(hz => <div key={hz} className={"rounded-lg border px-2 py-3 text-center " + (readings[hz] ? "border-emerald-600/20 bg-emerald-50 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-300" : "border-[var(--border)] text-[var(--muted)]")}><span className="block font-mono text-xs">{(hz / 1000).toFixed(1)}</span>{readings[hz] ? <Check className="mx-auto mt-2 size-3" /> : <span className="mt-2 block text-xs">—</span>}</div>)}</div><div className="mt-6 flex items-start gap-2 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]"><CircleHelp className="mt-0.5 size-4 shrink-0" /><p>These are local signal measurements, not an accuracy guarantee or proof of identity. Calibration results never authorize attendance.</p></div>{finished && <Button variant="secondary" size="sm" className="mt-4" onClick={download}><Download className="size-3.5" /> Download measurements</Button>}</section>
  </div>;
}
