"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { Toaster } from "sonner";

type Theme = "light" | "dark";

export function AppToaster() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const update = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    const frame = window.requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <Toaster
      theme={theme}
      position="top-right"
      closeButton
      expand
      visibleToasts={4}
      gap={10}
      icons={{
        success: <CheckCircle2 className="size-4 text-emerald-600 dark:text-lime-300" />,
        error: <CircleAlert className="size-4 text-red-600 dark:text-red-300" />,
        warning: <TriangleAlert className="size-4 text-amber-600 dark:text-amber-300" />,
        info: <Info className="size-4 text-cyan-700 dark:text-cyan-300" />,
        loading: <LoaderCircle className="size-4 animate-spin text-violet-600 dark:text-violet-300" />,
        close: <X className="size-3.5" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border-black/10 !bg-[#fbfaf5]/95 !text-[#111614] !shadow-[0_20px_60px_-26px_rgba(13,25,20,.45)] !backdrop-blur-xl dark:!border-white/10 dark:!bg-[#171e1a]/96 dark:!text-[#f4f2e9]",
          title: "!text-sm !font-extrabold !tracking-tight",
          description: "!text-xs !leading-5 !text-black/50 dark:!text-white/45",
          closeButton:
            "!border-black/8 !bg-[#f2f1eb] !text-black/45 hover:!text-black dark:!border-white/10 dark:!bg-[#262e29] dark:!text-white/45 dark:hover:!text-white",
          actionButton:
            "!rounded-lg !bg-[#151a17] !px-3 !text-xs !font-bold !text-white dark:!bg-[#b5f44b] dark:!text-[#172008]",
        },
      }}
    />
  );
}
