"use client";

import { DropdownMenu as DM } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const DropdownMenu = DM.Root;
const DropdownMenuTrigger = DM.Trigger;
const DropdownMenuGroup = DM.Group;

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DM.Item> & { variant?: "default" | "destructive" }) {
  return (
    <DM.Item
      data-variant={variant}
      className={cn(
        "relative flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-base outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[variant=destructive]:text-destructive md:min-h-10 md:text-sm [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[variant=destructive]:[&_svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("px-3 py-2 text-sm", className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
