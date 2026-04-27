"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Settings } from "lucide-react";

const links = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-100/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/80"
      aria-label="Main"
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== "/" && path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white text-sky-800 shadow dark:bg-zinc-800 dark:text-sky-200"
                : "text-zinc-600 hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
