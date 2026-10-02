"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function StudentSessionWatcher({
  initialSessionIds,
  classroomId,
}: {
  initialSessionIds: string[];
  classroomId?: string;
}) {
  const router = useRouter();
  const initialKey = [...initialSessionIds].sort().join(",");

  useEffect(() => {
    let previous = initialKey;
    let inFlight = false;
    let stopped = false;
    let controller: AbortController | null = null;
    const url = classroomId
      ? `/api/attendance/active?classroomId=${encodeURIComponent(classroomId)}`
      : "/api/attendance/active";

    async function checkForSessions() {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      controller = new AbortController();
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const payload: { sessionIds?: unknown } = await response.json();
        if (!Array.isArray(payload.sessionIds) || !payload.sessionIds.every((id) => typeof id === "string")) return;
        const current = [...payload.sessionIds].sort().join(",");
        if (!stopped && current !== previous) {
          previous = current;
          router.refresh();
        }
      } catch {
        // A temporary network error must not interrupt the student's page.
      } finally {
        inFlight = false;
        controller = null;
      }
    }

    void checkForSessions();
    const timer = window.setInterval(() => void checkForSessions(), 5_000);
    const onVisible = () => void checkForSessions();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      controller?.abort();
    };
  }, [classroomId, initialKey, router]);

  return null;
}
