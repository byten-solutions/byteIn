import * as React from "react"
import { cn } from "@/lib/utils"

export interface MobileCardListProps<T> {
  items: T[]
  renderCard: (item: T, index: number) => React.ReactNode
  keyExtractor?: (item: T, index: number) => string | number
  className?: string
}

export function MobileCardList<T>({
  items,
  renderCard,
  keyExtractor = (_, idx) => idx,
  className,
}: MobileCardListProps<T>) {
  return (
    <div className={cn("grid gap-3", className)}>
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)}>
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  )
}
