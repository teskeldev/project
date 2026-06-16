"use client";

import React from "react";
import { cn } from "./utils";

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "default" | "sm" | "lg";
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked = false, onCheckedChange, size = "default", disabled, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-7",
      default: "h-5 w-9",
      lg: "h-6 w-11",
    };

    const thumbSizeClasses = {
      sm: "h-3 w-3",
      default: "h-4 w-4",
      lg: "h-5 w-5",
    };

    const translateClasses = {
      sm: checked ? "translate-x-3" : "translate-x-0.5",
      default: checked ? "translate-x-4" : "translate-x-0.5",
      lg: checked ? "translate-x-5" : "translate-x-0.5",
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-[var(--accent)]" : "bg-[var(--border)]",
          sizeClasses[size],
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block rounded-full bg-white shadow-sm transition-transform",
            thumbSizeClasses[size],
            translateClasses[size]
          )}
        />
      </button>
    );
  }
);
Toggle.displayName = "Toggle";

export { Toggle };
