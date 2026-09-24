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
          "group flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-[0.8125rem] font-medium text-[var(--foreground)] outline-none transition-colors hover:border-[var(--muted)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 data-[state=open]:border-[var(--accent)] data-[placeholder]:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="size-3.5 shrink-0 text-[var(--muted)] transition-transform duration-150 group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--foreground)] shadow-lg shadow-black/8 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in motion-reduce:animate-none"
        >
          <Select.ScrollUpButton className="grid h-6 place-items-center text-[var(--muted)]">
            <ChevronUp className="size-3.5" />
          </Select.ScrollUpButton>
          <Select.Viewport className="max-h-[min(20rem,var(--radix-select-content-available-height))]">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-9 cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 text-[0.8125rem] font-medium outline-none data-[highlighted]:bg-[var(--accent-soft)] data-[highlighted]:text-[var(--accent)] data-[state=checked]:text-[var(--accent)]"
              >
                <Select.ItemIndicator className="absolute left-2.5 grid place-items-center">
                  <Check className="size-3.5" />
                </Select.ItemIndicator>
                <div>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  {option.description && (
                    <p className="mt-0.5 text-[0.6875rem] font-normal leading-4 text-[var(--muted)]">
                      {option.description}
                    </p>
                  )}
                </div>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="grid h-6 place-items-center text-[var(--muted)]">
            <ChevronDown className="size-3.5" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
