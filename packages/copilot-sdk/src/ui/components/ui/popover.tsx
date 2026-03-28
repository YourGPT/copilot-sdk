"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "../../lib/utils";

// ============================================
// Popover (Root)
// ============================================

export type PopoverProps = {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Popover({ children, open, defaultOpen, onOpenChange }: PopoverProps) {
  return (
    <BasePopover.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </BasePopover.Root>
  );
}

// ============================================
// PopoverTrigger
// ============================================

export type PopoverTriggerProps = {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
} & React.ComponentPropsWithoutRef<"button">;

function PopoverTrigger({
  children,
  asChild,
  className,
  ...props
}: PopoverTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return (
      <BasePopover.Trigger render={children} className={className} {...props} />
    );
  }

  return (
    <BasePopover.Trigger className={className} {...props}>
      {children}
    </BasePopover.Trigger>
  );
}

// ============================================
// PopoverContent
// ============================================

export type PopoverContentProps = {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

function PopoverContent({
  children,
  className,
  side = "bottom",
  align = "start",
  sideOffset = 4,
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset}>
        <BasePopover.Popup
          className={cn(
            "csdk-popover-popup",
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
            className,
          )}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

// ============================================
// Exports
// ============================================

export { Popover, PopoverTrigger, PopoverContent };
