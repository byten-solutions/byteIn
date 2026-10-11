"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("Unhandled application error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center shadow-xs">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-xs">
          An unexpected error occurred while loading this page. You can try refreshing or return to the overview.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            variant="default"
            size="sm"
            className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
          >
            <RefreshCw className="size-3.5" />
            <span>Try again</span>
          </Button>
          <Link href="/">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <Home className="size-3.5" />
              <span>Back to Overview</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
