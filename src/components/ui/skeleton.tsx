import * as React from "react"
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export function SkeletonLine({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={cn("h-3 w-full", className)} {...props} />
}

export function SkeletonBlock({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={cn("h-20 w-full", className)} {...props} />
}
