"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/eie", label: "Command Center", exact: true },
  { href: "/admin/eie/ingest", label: "Ingest Source" },
  { href: "/admin/eie/review", label: "Review Queue" },
  { href: "/admin/eie/connections", label: "Connections" },
];

type EieAdminNavProps = {
  pendingReviewCount: number;
};

export function EieAdminNav({ pendingReviewCount }: EieAdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
            {item.href === "/admin/eie/review" && pendingReviewCount > 0 ? (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                {pendingReviewCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
