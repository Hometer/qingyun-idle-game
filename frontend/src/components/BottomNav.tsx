"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const TABS = [
  { href: "/xiulian", label: "修炼", english: "CULTIVATE", icon: "sun" },
  { href: "/lilian", label: "历练", english: "EXPLORE", icon: "mountain" },
  { href: "/dongfu", label: "洞府", english: "ABODE", icon: "home" },
  { href: "/beibao", label: "背包", english: "INVENTORY", icon: "bag" },
  { href: "/renwu", label: "人物", english: "PROFILE", icon: "user" },
] as const;

export function NavIcon({ name, className = "" }: { name: (typeof TABS)[number]["icon"]; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} {...common}>
      {name === "sun" && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
      {name === "mountain" && <><path d="m2 19 7.2-12 4.2 6.7 2.2-3.6L22 19H2Z" /><path d="m6.6 11.3 2.6 1.4 2.2-1.5" /></>}
      {name === "home" && <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M9 20v-7h6v7M3 10h18" /></>}
      {name === "bag" && <><path d="M4 8h16l-1 13H5L4 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>}
      {name === "user" && <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0H4Z" /></>}
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="主导航" className="mobile-nav fixed bottom-0 left-0 right-0 z-20 lg:hidden">
      <div className="mobile-nav-inner mx-auto grid max-w-[780px] grid-cols-5 border-t border-gold/40 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(25,43,38,.16)] backdrop-blur-xl">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`mobile-nav-link relative flex min-h-[66px] flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${active ? "font-semibold text-cinnabar" : "text-muted"}`}
            >
              {active && <span className="absolute inset-x-5 top-0 h-[2px] bg-cinnabar" />}
              <NavIcon name={t.icon} className="h-[21px] w-[21px]" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
