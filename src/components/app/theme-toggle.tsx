"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ThemeToggle({ mini = false }: { mini?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = mounted && isDark ? Sun : Moon;

  if (mini) {
    return (
      <Tooltip content={label} side="right">
        <Button variant="ghost" size="icon" className="w-full" onClick={toggle} aria-label={label}>
          <Icon className="size-4" />
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn("w-full justify-start text-muted-foreground")}
      onClick={toggle}
      aria-label={label}
    >
      <Icon className="size-4" /> {mounted && isDark ? "Light mode" : "Dark mode"}
    </Button>
  );
}
