import Image from "next/image";
import { cn } from "@/lib/utils";

/** "Propulsé par Parcolia" with the small Parcolia icon (sidebar, menu, contract page). */
export function PoweredBy({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center gap-1.5", className)}>
      <Image src="/brand/parcolia-icon.png" alt="" width={16} height={16} className="size-4 dark:hidden" />
      <Image src="/brand/parcolia-icon-dark.png" alt="" width={16} height={16} className="hidden size-4 dark:block" />
      {label}
    </span>
  );
}
