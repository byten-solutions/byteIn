"use client"

import * as React from "react"
import { Printer, ArrowLeft } from "lucide-react"

export function PrintToolbar() {
  React.useEffect(() => {
    // Automatically trigger print dialog on page load
    const timer = setTimeout(() => {
      window.print()
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="print:hidden mb-6 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 shadow-xs">
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) {
            window.history.back()
          } else {
            window.close()
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 cursor-pointer"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back</span>
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Press Print to produce physical document or PDF</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 cursor-pointer"
        >
          <Printer className="size-3.5" />
          <span>Print Document</span>
        </button>
      </div>
    </div>
  )
}
