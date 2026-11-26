"use client";

import { XIcon } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = D.Root;
const DialogTrigger = D.Trigger;
const DialogClose = D.Close;

/** Bottom sheet on phones, centred dialog from 640px. */
function DialogContent({
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof D.Content> & { closeLabel: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <D.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-card-foreground shadow-xl outline-none sm:inset-x-auto sm:bottom-auto sm:start-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:ltr:-translate-x-1/2 sm:rtl:translate-x-1/2",
          className,
        )}
        {...props}
      >
        {children}
        <D.Close
          className="absolute end-2 top-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={closeLabel}
        >
          <XIcon className="size-5" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 pe-10", className)} {...props} />;
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof D.Title>) {
  return <D.Title className={cn("text-lg font-semibold", className)} {...props} />;
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof D.Description>) {
  return <D.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
