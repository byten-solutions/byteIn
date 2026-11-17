"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  ChevronDown,
  Check,
  Layers,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface PropertyOption {
  id: string
  name: string
  city?: string | null
  status?: string
}

export interface PropertyContextSelectorProps {
  properties: PropertyOption[]
  selectedPropertyId?: string
}

export function PropertyContextSelector({
  properties,
  selectedPropertyId,
}: PropertyContextSelectorProps) {
  const router = useRouter()

  const currentProperty = properties.find((p) => p.id === selectedPropertyId)

  const handleSelect = (propertyId: string | null) => {
    if (!propertyId) {
      router.push("/")
    } else {
      router.push(`/?propertyId=${propertyId}`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-border/80 font-medium max-w-[240px]"
        >
          {currentProperty ? (
            <>
              <Building2 className="size-3.5 text-primary shrink-0" />
              <span className="truncate">{currentProperty.name}</span>
            </>
          ) : (
            <>
              <Layers className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>All Properties (Portfolio)</span>
            </>
          )}
          <ChevronDown className="size-3.5 text-muted-foreground ml-auto shrink-0" />
        </Button>
      } />
      <DropdownMenuContent align="start" className="min-w-[280px] max-w-[360px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Property Scope
          </DropdownMenuLabel>
          
          {/* Global Portfolio Mode Option */}
          <DropdownMenuItem
            onClick={() => handleSelect(null)}
            className="text-xs flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="size-3.5 text-purple-600 dark:text-purple-400" />
              <div className="space-y-0.5">
                <div className="font-semibold text-foreground">All Properties</div>
                <div className="text-[10px] text-muted-foreground">Portfolio Overview Mode</div>
              </div>
            </div>
            {!selectedPropertyId && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Single Hotel View
          </DropdownMenuLabel>

          {properties.map((prop) => {
            const isSelected = prop.id === selectedPropertyId
            return (
              <DropdownMenuItem
                key={prop.id}
                onClick={() => handleSelect(prop.id)}
                className="text-xs flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="size-3.5 text-primary shrink-0" />
                  <div className="truncate space-y-0.5">
                    <div className="font-medium text-foreground truncate">{prop.name}</div>
                    {prop.city && (
                      <div className="text-[10px] text-muted-foreground">{prop.city}</div>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
