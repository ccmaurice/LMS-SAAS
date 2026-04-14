"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const outlinedChrome =
  "size-8 shrink-0 rounded-lg border-border/80 bg-background/95 text-foreground shadow-xs backdrop-blur-sm dark:border-white/12 dark:bg-background/40";

export function ThemeToggle({ variant = "ghost" }: { variant?: "ghost" | "outlined" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: theme is unknown until client mount (next-themes pattern).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only gate
    setMounted(true);
  }, []);

  const outlined = variant === "outlined";

  if (!mounted) {
    return (
      <Button
        type="button"
        variant={outlined ? "outline" : "ghost"}
        size={outlined ? "icon" : "icon-sm"}
        className={cn(outlined ? outlinedChrome : "size-8 shrink-0")}
        aria-label="Theme"
      >
        <span className="size-4" />
      </Button>
    );
  }

  const dark = resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant={outlined ? "outline" : "ghost"}
      size={outlined ? "icon" : "icon-sm"}
      className={cn(outlined ? outlinedChrome : "size-8 shrink-0")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
