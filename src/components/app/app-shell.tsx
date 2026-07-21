"use client";

import {
  BookOpen,
  Boxes,
  FileText,
  FolderKanban,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  ShieldAlert,
  Workflow,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SwitcherProject {
  id: string;
  name: string;
  status: string;
}

interface AppShellProps {
  user: { name?: string | null; email?: string | null };
  projects: SwitcherProject[];
  children: React.ReactNode;
}

const COLLAPSE_KEY = "mcpthreat.sidebar.collapsed";

function useActiveProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

export function AppShell({ user, projects, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const activeProjectId = useActiveProjectId(pathname);

  // Restore + persist the collapsed preference.
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const globalNav: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/security-guidance", label: "Security Guidance", icon: BookOpen },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const projectNav: NavItem[] = activeProjectId
    ? [
        { href: `/projects/${activeProjectId}`, label: "Overview", icon: FolderKanban, exact: true },
        { href: `/projects/${activeProjectId}/model`, label: "Threat Model", icon: Boxes },
        { href: `/projects/${activeProjectId}/architecture`, label: "Architecture", icon: Network },
        { href: `/projects/${activeProjectId}/dataflow`, label: "Dataflow", icon: Workflow },
        { href: `/projects/${activeProjectId}/findings`, label: "Findings", icon: ShieldAlert },
        { href: `/projects/${activeProjectId}/activity`, label: "Activity", icon: History },
        { href: `/projects/${activeProjectId}/report`, label: "Report", icon: FileText },
      ]
    : [];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const NavLink = ({ item, mini }: { item: NavItem; mini: boolean }) => {
    const active = isActive(item.href, item.exact);
    const Icon = item.icon;
    const link = (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-md py-2 text-sm transition-colors",
          mini ? "justify-center px-2" : "px-3",
          active
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        aria-label={item.label}
      >
        <Icon className="size-4 shrink-0" />
        {mini ? null : item.label}
      </Link>
    );
    return mini ? (
      <Tooltip content={item.label} side="right">
        {link}
      </Tooltip>
    ) : (
      link
    );
  };

  const Sidebar = ({ mini }: { mini: boolean }) => (
    <div className="flex h-full flex-col gap-4">
      <div className={cn("flex items-center", mini ? "flex-col gap-2" : "justify-between")}>
        <Link
          href="/"
          className={cn("flex items-center gap-2", mini ? "" : "px-2")}
          onClick={() => setMobileOpen(false)}
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Shield className="size-5" />
          </div>
          {mini ? null : (
            <span className="text-lg font-semibold tracking-tight">MCPThreat</span>
          )}
        </Link>
        {/* Collapse toggle (desktop only) */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-7 w-7 md:inline-flex"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      {mini ? null : (
        <div className="px-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Project
          </label>
          <Select
            value={activeProjectId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) router.push(`/projects/${val}`);
            }}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <nav className={cn("flex flex-col gap-1", mini ? "px-1" : "px-2")}>
        {globalNav.map((item) => (
          <NavLink key={item.href} item={item} mini={mini} />
        ))}
      </nav>

      {projectNav.length > 0 ? (
        <nav className={cn("flex flex-col gap-1 border-t pt-4", mini ? "px-1" : "px-2")}>
          {mini ? null : (
            <span className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current Project
            </span>
          )}
          {projectNav.map((item) => (
            <NavLink key={item.href} item={item} mini={mini} />
          ))}
        </nav>
      ) : null}

      <div className={cn("mt-auto border-t pt-3", mini ? "px-1" : "px-2")}>
        {mini ? null : (
          <div className="px-3 pb-2 text-xs text-muted-foreground">
            <div className="truncate font-medium text-foreground">{user.name ?? "Account"}</div>
            <div className="truncate">{user.email}</div>
          </div>
        )}
        <ThemeToggle mini={mini} />
        {mini ? (
          <Tooltip content="Sign out" side="right">
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-card p-3 transition-[width] duration-200 md:block",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <Sidebar mini={collapsed} />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r bg-card p-4">
            <Sidebar mini={false} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b p-4 md:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
          <span className="font-semibold">MCPThreat</span>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
