import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-6 text-sm leading-loose">
        <div className="flex items-center gap-3">
          <Logo size={44} showWordmark={false} />
          <div>
            <h1 className="text-xl font-bold tracking-tight">byteInn</h1>
            <p className="text-xs text-muted-foreground">Reception Room Management System</p>
          </div>
        </div>
        <div>
          <h2 className="font-medium">Project ready!</h2>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button className="mt-3">Button</Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}
