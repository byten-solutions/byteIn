import Link from "next/link"
import { FileQuestion, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center shadow-xs">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-6" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-xs">
          The page or resource you are looking for does not exist or may have been moved.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button
              variant="default"
              size="sm"
              className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
            >
              <Home className="size-3.5" />
              <span>Back to Overview</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
