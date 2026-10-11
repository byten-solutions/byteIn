import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: number
  showWordmark?: boolean
}

export function Logo({ className, size = 32, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 font-semibold", className)}>
      <Image
        src="/logo.png"
        alt="byteInn Logo"
        width={size}
        height={size}
        className="shrink-0 dark:invert"
        priority
      />
      {showWordmark && <span className="tracking-tight text-lg">byteInn</span>}
    </div>
  )
}
