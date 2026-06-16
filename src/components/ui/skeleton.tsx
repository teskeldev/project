"use client";

import React from "react";
import { cn } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg bg-[var(--surface-soft)] animate-shimmer",
        className
      )}
      {...props}
    />
  )
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
