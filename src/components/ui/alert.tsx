import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex w-full items-start gap-3 rounded-xl border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0", {
  variants: {
    variant: {
      info: "border-info/30 bg-info-soft text-foreground [&>svg]:text-info",
      warning: "border-warning/30 bg-warning-soft text-foreground [&>svg]:text-warning",
      danger: "border-destructive/30 bg-danger-soft text-foreground [&>svg]:text-destructive",
      success: "border-success/30 bg-success-soft text-foreground [&>svg]:text-success",
    },
  },
  defaultVariants: { variant: "info" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
