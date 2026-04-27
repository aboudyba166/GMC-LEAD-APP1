"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_TAG_CLASS,
  LEAD_STATUS,
  STATUSES_BY_CATEGORY,
  type LeadStatus,
  type StatusCategory,
} from "@/lib/lead-status";

const categoryOrder: StatusCategory[] = ["active", "success", "lost", "invalid"];

const labels: Record<StatusCategory, string> = {
  active: "Active / needs action",
  success: "Success",
  lost: "Lost / rejected",
  invalid: "Invalid / junk",
};

type Props = {
  value: LeadStatus;
  onChange: (v: LeadStatus) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

export function LeadStatusSelect({ value, onChange, disabled, "aria-label": ariaLabel }: Props) {
  return (
    <Select.Root
      value={value}
      onValueChange={(v) => onChange(v as LeadStatus)}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label={ariaLabel ?? "Lead status"}
        className={cn(
          "inline-flex h-9 min-w-[200px] max-w-[min(100vw,280px)] items-center justify-between gap-1 rounded-md border border-zinc-200 bg-white px-2.5 text-left text-xs",
          "focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-600 dark:bg-zinc-800",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <Select.Value>
          <span
            className={cn(
              "inline-block max-w-[220px] truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
              CATEGORY_TAG_CLASS[categoryFor(value)]
            )}
          >
            {value}
          </span>
        </Select.Value>
        <Select.Icon>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="z-50 max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          position="popper"
          sideOffset={4}
        >
          <Select.ScrollUpButton className="flex h-6 cursor-default items-center justify-center text-zinc-500">
            <ChevronUp className="h-4 w-4" />
          </Select.ScrollUpButton>
          <Select.Viewport className="p-1.5">
            {categoryOrder.map((cat) => (
              <Select.Group key={cat}>
                <Select.Label className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {labels[cat]}
                </Select.Label>
                {STATUSES_BY_CATEGORY[cat].map((s) => (
                  <SelectItem key={s} value={s} category={cat} />
                ))}
              </Select.Group>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-6 cursor-default items-center justify-center text-zinc-500">
            <ChevronDown className="h-4 w-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function categoryFor(s: LeadStatus): StatusCategory {
  if (s === LEAD_STATUS.BOOKED) return "success";
  if (s === LEAD_STATUS.NOT_INTERESTED || s === LEAD_STATUS.PRICE_HIGH) return "lost";
  if (
    s === LEAD_STATUS.SENT_MISTAKE ||
    s === LEAD_STATUS.WRONG_NUMBER ||
    s === LEAD_STATUS.OUT_OF_SERVICE
  )
    return "invalid";
  return "active";
}

function SelectItem({
  value,
  category,
}: {
  value: LeadStatus;
  category: StatusCategory;
}) {
  return (
    <Select.Item
      value={value}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-xs leading-tight",
        "outline-none data-[highlighted]:bg-zinc-100 data-[state=checked]:font-medium",
        "dark:data-[highlighted]:bg-zinc-800"
      )}
    >
      <Select.ItemText asChild>
        <span
          className={cn(
            "max-w-[240px] rounded border px-1.5 py-0.5",
            CATEGORY_TAG_CLASS[category]
          )}
        >
          {value}
        </span>
      </Select.ItemText>
      <span className="absolute right-2 flex w-3.5 items-center justify-center">
        <Select.ItemIndicator>
          <Check className="h-3.5 w-3.5 text-sky-600" />
        </Select.ItemIndicator>
      </span>
    </Select.Item>
  );
}
