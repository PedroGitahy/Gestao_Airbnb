"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; group: string; badge?: number };

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const groups = Array.from(new Set(items.map((i) => i.group)));
  return (
    <>
      {groups.map((g) => (
        <div className="nav-group" key={g}>
          <span>{g}</span>
          {items
            .filter((i) => i.group === g)
            .map((i) => {
              const active = i.href === "/central" ? path === "/central" : path === i.href || path.startsWith(i.href + "/");
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className="nav-link"
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                >
                  {i.label}
                  {i.badge ? <span className="nav-badge">{i.badge}</span> : null}
                </Link>
              );
            })}
        </div>
      ))}
    </>
  );
}
