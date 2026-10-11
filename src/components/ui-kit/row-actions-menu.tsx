"use client"

import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ActionItem {
  label: string
  icon?: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  variant?: "default" | "destructive"
}

export interface RowActionsMenuProps {
  items?: ActionItem[]
  children?: React.ReactNode
  align?: "start" | "end" | "center"
  className?: string
  buttonClassName?: string
}

export function RowActionsMenu({
  items,
  children,
  align = "end",
  className,
  buttonClassName,
}: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8 p-0 text-muted-foreground hover:text-foreground", buttonClassName)}
            aria-label="Open actions"
          />
        }
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("w-44", className)}>
        {items ? (
          items.map((item, idx) => (
            <DropdownMenuItem
              key={idx}
              disabled={item.disabled}
              variant={item.variant}
              onClick={item.onClick}
              className="gap-2 text-xs"
            >
              {item.icon}
              <span>{item.label}</span>
            </DropdownMenuItem>
          ))
        ) : (
          children
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
