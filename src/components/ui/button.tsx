import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[#151a17] text-white shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:bg-black dark:bg-[#f1efe6] dark:text-[#111614] dark:hover:bg-white",
        brand:
          "bg-[#151a17] text-white shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:bg-black dark:bg-[#b5f44b] dark:text-[#172008] dark:shadow-lime-950/10 dark:hover:bg-[#c4ff5c]",
        secondary:
          "border border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 dark:border-white/12 dark:bg-white/6 dark:text-white/75 dark:hover:bg-white/10",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white",
        danger:
          "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/15",
      },
      size: {
        sm: "min-h-9 rounded-lg px-3 text-xs",
        md: "min-h-10",
        lg: "min-h-12 rounded-[0.9rem] px-5 text-[0.95rem]",
        icon: "size-10 min-h-10 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
