"use client";

import { EllipsisVerticalIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

export type RowMenuItem =
  | { label: string; icon: LucideIcon; href: string; destructive?: boolean; disabled?: boolean; separatorBefore?: boolean }
  | { label: string; icon: LucideIcon; onSelect: () => void; destructive?: boolean; disabled?: boolean; separatorBefore?: boolean };

/** "⋯" button at the end of a table row, with the row's actions (icon + short label each). */
export function RowMenu({ label, items, testId }: { label: string; items: RowMenuItem[]; testId?: string }) {
  if (!items.length) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} data-testid={testId} className="text-muted-foreground hover:text-foreground">
          <EllipsisVerticalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon aria-hidden />
              {item.label}
            </>
          );
          return (
            <span key={item.label} className="contents">
              {item.separatorBefore ? <DropdownMenuSeparator /> : null}
              {"href" in item ? (
                <DropdownMenuItem asChild disabled={item.disabled} variant={item.destructive ? "destructive" : "default"}>
                  <Link href={item.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled={item.disabled} variant={item.destructive ? "destructive" : "default"} onSelect={item.onSelect}>
                  {content}
                </DropdownMenuItem>
              )}
            </span>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
