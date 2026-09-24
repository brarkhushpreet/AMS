"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { AudioLines, Hand, LockKeyhole, UsersRound } from "lucide-react";

type CompanionMood = "curious" | "shy" | "error" | "happy" | "checking";
export const AUTH_COMPANION_EVENT = "classpulse:auth-companion";

// Only visual state crosses this boundary. The illustration never reads inputs.
export function notifyAuthCompanion(mood: CompanionMood) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_COMPANION_EVENT, { detail: { mood } }));
}

const expressions = {
  curious: { title: "A familiar face. A fresh start.", detail: "Your classrooms are just a sign-in away.", status: "Here with you" },
  shy: { title: "Some things are just for you.", detail: "Eyes covered. Take your time with your password.", status: "Eyes covered" },
  error: { title: "Let’s give that another go.", detail: "Something didn’t match. Check your details and try again.", status: "Try again" },
  happy: { title: "Good to see you, too.", detail: "A little hello before you get back to your day.", status: "Hello there" },
  checking: { title: "One moment. You’re nearly there.", detail: "Checking your details and finding your workspace.", status: "Checking details" },
} satisfies Record<CompanionMood, { title: string; detail: string; status: string }>;

export function AuthCompanion() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [requestedMood, setRequestedMood] = useState<CompanionMood>("curious");
  const [greeting, setGreeting] = useState(false);
  const [blink, setBlink] = useState(false);
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const pupilX = useSpring(x, { stiffness: 180, damping: 22 });
  const pupilY = useSpring(y, { stiffness: 180, damping: 22 });
  const mood = requestedMood === "curious" && greeting ? "happy" : requestedMood;
  const closed = mood === "shy";
  const copy = expressions[mood];
  const transition = { duration: reducedMotion ? 0 : .24 };

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || closed || reducedMotion) return;
      x.set(Math.max(-7, Math.min(7, (event.clientX - rect.left - rect.width / 2) / 35)));
      y.set(Math.max(-5, Math.min(5, (event.clientY - rect.top - rect.height / 2) / 45)));
    };
    const reset = () => { x.set(0); y.set(0); };
    const onMood = (event: Event) => {
      const next = (event as CustomEvent<{ mood?: CompanionMood }>).detail?.mood;
      if (next && Object.hasOwn(expressions, next)) setRequestedMood(next);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("blur", reset);
    window.addEventListener(AUTH_COMPANION_EVENT, onMood);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("blur", reset);
      window.removeEventListener(AUTH_COMPANION_EVENT, onMood);
    };
  }, [closed, reducedMotion, x, y]);

  useEffect(() => {
    if (!greeting) return;
    const timer = window.setTimeout(() => setGreeting(false), 2200);
    return () => window.clearTimeout(timer);
  }, [greeting]);

  useEffect(() => {
    if (reducedMotion || closed) return;
    let opening: ReturnType<typeof setTimeout>;
    const timer = window.setInterval(() => {
      setBlink(true);
      opening = setTimeout(() => setBlink(false), 140);
    }, 4600);
    return () => { clearInterval(timer); clearTimeout(opening); setBlink(false); };
  }, [closed, reducedMotion]);

  return (
    <div className="auth-companion w-full" data-mood={mood}>
      <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
        <span className="font-medium">Meet Pulse, your classroom companion</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
          <span className="size-1.5 rounded-full bg-[var(--accent)]" />
          {copy.status}
        </span>
      </div>

      <div ref={stageRef} className="companion-stage relative my-5 grid h-[clamp(220px,35dvh,380px)] place-items-center">
        <div aria-hidden="true" className="absolute inset-x-[6%] inset-y-[5%] rounded-[50%] border border-dashed border-[var(--companion-guide)]" />
        <div aria-hidden="true" className="absolute inset-x-[17%] inset-y-[17%] rounded-[50%] border border-[var(--companion-guide)]" />

        <div aria-hidden="true" className="absolute top-[5%] left-0 -rotate-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--muted)]"><UsersRound className="size-3.5 text-[var(--accent)]" /> A place for your class</div>
          <div className="mt-2.5 flex -space-x-1.5">{["bg-[#91a8d8]", "bg-[#b5a4cd]", "bg-[#d0b78e]", "bg-[#8aadb7]"].map(color => <span key={color} className={"size-5 rounded-full border-2 border-[var(--surface)] " + color} />)}<span className="ml-2 self-center text-[9px] text-[var(--muted)]">All together.</span></div>
        </div>

        <motion.svg aria-hidden="true" viewBox="0 0 420 310" className="relative z-10 w-[min(100%,370px)] overflow-visible" animate={reducedMotion ? {} : mood === "error" ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }} transition={{ duration: .4 }}>
          <ellipse cx="210" cy="281" rx="88" ry="8" fill="var(--companion-guide)" />
          <motion.g animate={reducedMotion ? {} : mood === "happy" ? { y: [0, -9, 0] } : { y: [0, -4, 0] }} transition={{ duration: mood === "happy" ? .6 : 5, repeat: reducedMotion ? 0 : Infinity, ease: "easeInOut" }}>
            <path d="M192 244 L188 270 Q194 277 209 270 L209 244 M223 244 L224 270 Q238 277 245 270 L241 244" fill="var(--companion-body)" stroke="var(--companion-outline)" strokeWidth="2" />
            <path d="M212 73 L212 52" stroke="var(--companion-outline)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="212" cy="45" r="8" fill="var(--companion-body)" stroke="var(--companion-outline)" strokeWidth="2" />
            <path d="M196 40 Q192 45 196 50 M228 40 Q232 45 228 50" fill="none" stroke="var(--companion-outline)" strokeWidth="2" strokeLinecap="round" opacity=".5" />
            <rect x="104" y="75" width="212" height="179" rx="63" fill="var(--companion-body)" stroke="var(--companion-outline)" strokeWidth="2" />
            <path d="M128 113 Q145 87 183 88" fill="none" stroke="var(--companion-highlight)" strokeWidth="3" strokeLinecap="round" />
            <rect x="120" y="105" width="180" height="119" rx="46" fill="var(--companion-face)" />
            {[164, 252].map((cx, eye) => (
              <g key={cx}>
                <motion.path d={"M" + (cx - 13) + " 126 Q" + cx + " 121 " + (cx + 13) + " 126"} fill="none" stroke="var(--companion-ink)" strokeWidth="3" strokeLinecap="round" animate={{ rotate: mood === "error" ? (eye ? 17 : -17) : mood === "happy" ? (eye ? -8 : 8) : 0, y: closed ? 3 : mood === "checking" ? -4 : 0 }} style={{ transformOrigin: cx + "px 126px" }} transition={transition} />
                <motion.g animate={{ opacity: closed || blink ? 0 : 1, scaleY: closed || blink ? .1 : 1 }} style={{ transformOrigin: cx + "px 160px" }} transition={transition}>
                  <ellipse cx={cx} cy="158" rx="26" ry="30" fill="#fbfcff" />
                  <motion.g style={{ x: pupilX, y: pupilY }}>
                    <circle cx={cx} cy="160" r={mood === "checking" ? 10 : 12} fill="#293b59" />
                    <circle cx={cx + 4} cy="155" r="3.5" fill="#fff" />
                  </motion.g>
                </motion.g>
                <motion.path d={"M" + (cx - 18) + " 159 Q" + cx + " 174 " + (cx + 18) + " 159"} fill="none" stroke="var(--companion-ink)" strokeWidth="3" strokeLinecap="round" animate={{ opacity: closed || blink ? 1 : 0 }} transition={transition} />
              </g>
            ))}
            <motion.g animate={{ opacity: closed || mood === "happy" ? .6 : 0 }} transition={transition}>
              <ellipse cx="143" cy="192" rx="10" ry="4" fill="#c88292" /><ellipse cx="276" cy="192" rx="10" ry="4" fill="#c88292" />
            </motion.g>
            <motion.path animate={{ d: mood === "error" ? "M196 204 Q210 187 224 204" : mood === "checking" ? "M204 199 Q210 195 216 199" : mood === "happy" ? "M191 193 Q210 222 229 193" : closed ? "M202 200 Q212 209 223 197" : "M197 196 Q210 211 223 196" }} fill={mood === "happy" ? "var(--companion-ink)" : "none"} stroke="var(--companion-ink)" strokeWidth="3" strokeLinecap="round" transition={transition} />
            {mood === "happy" && <path d="M201 195 L220 195 Q211 203 201 195" fill="#fbfcff" />}
            {/* Hands visibly cover the eyes; privacy is not just a hidden pupil. */}
            <motion.g animate={{ x: closed ? 62 : 0, y: closed ? -54 : 0, rotate: closed ? -14 : 0 }} style={{ transformOrigin: "111px 208px" }} transition={transition}>
              <path d="M112 193 Q86 189 86 205 L86 222 Q99 239 118 221 Z" fill="var(--companion-body)" stroke="var(--companion-outline)" strokeWidth="2" />
              <path d="M95 200 L98 214 M103 198 L106 210" fill="none" stroke="var(--companion-outline)" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
            <motion.g animate={closed ? { x: -66, y: -54, rotate: 14 } : mood === "happy" && !reducedMotion ? { x: 9, y: -42, rotate: [-12, 16, -12, 16, -12] } : { x: 0, y: 0, rotate: 0 }} style={{ transformOrigin: "309px 208px" }} transition={mood === "happy" ? { duration: 1.1, repeat: reducedMotion ? 0 : 1 } : transition}>
              <path d="M308 193 Q334 189 334 205 L334 222 Q321 239 302 221 Z" fill="var(--companion-body)" stroke="var(--companion-outline)" strokeWidth="2" />
              <path d="M325 200 L322 214 M317 198 L314 210" fill="none" stroke="var(--companion-outline)" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
          </motion.g>
        </motion.svg>

        <div aria-hidden="true" className="absolute right-0 bottom-[6%] z-20 flex rotate-3 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-sm">
          <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">{closed ? <LockKeyhole className="size-3.5" /> : <AudioLines className="size-3.5" />}</span>
          <div><p className="text-[10px] font-medium">{closed ? "A little privacy" : "Less roll call"}</p><p className="mt-0.5 text-[9px] text-[var(--muted)]">{closed ? "Just between you and the form." : "More room for learning."}</p></div>
        </div>
      </div>

      <div className="min-h-[100px]" aria-live="polite" aria-atomic="true">
        <h2 className="max-w-sm text-[clamp(1.65rem,2.2vw,2.15rem)] leading-[1.17] font-medium tracking-[-.04em]">{copy.title}</h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">{copy.detail}</p>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
        <span className="text-[10px] text-[var(--muted)]">A little company before class.</span>
        <button type="button" onClick={() => setGreeting(true)} disabled={requestedMood !== "curious" || greeting} className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50" aria-label="Say hello to Pulse"><Hand className="size-3.5" /> Say hello</button>
      </div>
    </div>
  );
}
