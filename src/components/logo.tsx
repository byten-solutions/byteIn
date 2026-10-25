import { cn } from "@/lib/utils"

export interface LogoProps {
  className?: string
  size?: number
  showWordmark?: boolean
}

export function LogoIcon({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={cn("shrink-0 text-foreground", className)}
      style={{ width: size, height: size }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 347 119 L 360 119 L 373 124 L 384 135 L 389 150 L 389 914 L 234 914 L 228 912 L 212 906 L 198 893 L 190 880 L 184 859 L 184 229 L 190 213 L 204 198 L 333 124 Z M 519 394 L 533 394 L 548 399 L 797 547 L 841 576 L 851 587 L 861 604 L 866 622 L 867 642 L 867 914 L 748 914 L 703 914 L 703 705 L 700 688 L 688 667 L 676 656 L 656 643 L 438 515 L 419 509 L 403 512 L 403 474 L 408 462 L 487 409 L 508 397 Z M 424 578 L 429 579 L 582 671 L 599 688 L 606 707 L 606 914 L 424 914 Z M 471 761 L 463 764 L 457 770 L 454 776 L 454 789 L 457 796 L 463 802 L 470 805 L 481 805 L 487 803 L 495 795 L 498 787 L 498 778 L 495 771 L 488 764 L 481 761 Z"
      />
    </svg>
  )
}

export function Logo({ className, size = 32, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 font-semibold", className)}>
      <LogoIcon size={size} />
      {showWordmark && (
        <span className="tracking-tight text-lg text-foreground">byteInn</span>
      )}
    </div>
  )
}
