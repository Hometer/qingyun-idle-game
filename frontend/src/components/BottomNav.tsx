"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/xiulian", label: "修炼" },
  { href: "/lilian", label: "历练" },
  { href: "/dongfu", label: "洞府" },
  { href: "/beibao", label: "背包" },
  { href: "/renwu", label: "人物" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20">
      <div className="mx-auto flex max-w-[560px] border-t border-line bg-card">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 py-2.5 text-center text-sm ${
                active ? "font-semibold text-cinnabar" : "text-ink/70"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
