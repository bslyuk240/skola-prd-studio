"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserButton, useClerk, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Plus,
  FileText,
  Shield,
  CheckSquare,
  Bot,
  Download,
  Settings,
  HelpCircle,
  LogOut,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditUsageCompact } from "@/components/dashboard/credit-usage-widget";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/new-blueprint", icon: Plus, label: "New Blueprint" },
  { href: "/feature-planner", icon: GitBranch, label: "Feature Planner" },
  { href: "/security-fix-planner", icon: Shield, label: "Security Planner" },
];

const projectItems = [
  { icon: FileText, label: "Documents", segment: "documents" },
  { icon: Shield, label: "Security Center", segment: "security" },
  { icon: CheckSquare, label: "Build Tasks", segment: "tasks" },
  { icon: Bot, label: "Agent Progress", segment: "agent" },
  { icon: Download, label: "Export", segment: "export" },
];

interface SidebarProps {
  projectId?: string;
  projectName?: string;
}

export function Sidebar({ projectId, projectName }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <Image src="/prd-logo.png" alt="SkolaTech PRD Studio" width={28} height={28} className="rounded-lg shrink-0" />
        <div>
          <p className="text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-widest leading-none">SkolaTech</p>
          <p className="text-sm font-bold text-sidebar-foreground leading-tight">PRD Studio</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {projectId && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider truncate">
                {projectName ?? "Current Project"}
              </p>
            </div>
            {projectItems.map(({ icon: Icon, label, segment }) => {
              const href = `/projects/${projectId}/${segment}`;
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={segment}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Credit gauge */}
      <div className="border-t border-sidebar-border pt-2">
        <CreditUsageCompact />
      </div>

      {/* Bottom */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-0.5">
        {[
          { href: "/settings", icon: Settings, label: "Settings" },
          { href: "/help", icon: HelpCircle, label: "Help" },
        ].map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
        {/* Account row */}
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
          <UserButton />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.fullName ?? user?.firstName ?? "Account"}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user?.emailAddresses[0]?.emailAddress ?? ""}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
