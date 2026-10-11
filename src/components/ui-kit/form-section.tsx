import * as React from "react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

export interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string | React.ReactNode
  withSeparator?: boolean
  children: React.ReactNode
}

export function FormSection({
  title,
  description,
  withSeparator = false,
  children,
  className,
  ...props
}: FormSectionProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="grid gap-5">{children}</div>

      {withSeparator && <Separator className="mt-6" />}
    </div>
  )
}
