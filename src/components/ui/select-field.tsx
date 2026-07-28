"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select } from "radix-ui";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function SelectField({
  id,
  name,
  value,
  defaultValue,
  placeholder = "Select an option",
  options,
  onValueChange,
  disabled,
  className,
  ariaLabel,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options: SelectOption[];
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Select.Root
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "group flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/70 px-3.5 text-left text-xs font-bold text-slate-700 shadow-sm outline-none hover:border-black/20 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/8 data-[placeholder]:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:border-white/20 dark:data-[placeholder]:text-white/30",
          className,
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="size-3.5 text-slate-400 transition-transform group-data-[state=open]:rotate-180 dark:text-white/35" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-black/10 bg-[#fbfaf5]/98 p-1.5 text-[#111614] shadow-[0_24px_70px_-28px_rgba(9,20,15,.5)] backdrop-blur-xl data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in dark:border-white/10 dark:bg-[#171e1a]/98 dark:text-[#f4f2e9]"
        >
          <Select.ScrollUpButton className="grid h-7 place-items-center text-slate-400">
            <ChevronUp className="size-3.5" />
          </Select.ScrollUpButton>
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-10 cursor-default select-none items-center rounded-xl py-2 pl-9 pr-3 text-xs font-bold outline-none data-[highlighted]:bg-emerald-100/70 data-[highlighted]:text-emerald-900 data-[state=checked]:text-emerald-800 dark:data-[highlighted]:bg-lime-300/10 dark:data-[highlighted]:text-lime-200 dark:data-[state=checked]:text-lime-300"
              >
                <Select.ItemIndicator className="absolute left-3 grid place-items-center">
                  <Check className="size-3.5" />
                </Select.ItemIndicator>
                <div>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  {option.description && (
                    <p className="mt-0.5 text-[0.62rem] font-medium text-slate-400 dark:text-white/32">
                      {option.description}
                    </p>
                  )}
                </div>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="grid h-7 place-items-center text-slate-400">
            <ChevronDown className="size-3.5" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
