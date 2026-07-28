import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 flex items-center justify-between text-xs font-bold tracking-wide text-slate-700 dark:text-white/65"
    >
      <span>{children}</span>
      {hint && <span className="text-xs font-medium text-slate-400">{hint}</span>}
    </label>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-950 shadow-sm transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:shadow-[0_0_0_4px_rgba(16,185,129,.09)] dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:hover:border-white/18",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:hover:border-white/18",
        className,
      )}
      {...props}
    />
  );
}
