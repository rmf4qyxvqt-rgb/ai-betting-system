"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/predictions", label: "Mercados" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="desk-nav fade-in rounded-[28px] p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#91afd8]">AI Sports Analytics System</p>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-white md:text-3xl">Betting Control Room</h1>
          <p className="mt-1 text-sm text-[#c9d7ee]">Operação orientada por linha, risco e leitura de mercado.</p>
        </div>
        <nav className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-[#d3ab67] bg-[#d3ab67] text-[#111827]"
                    : "border-white/15 bg-white/5 text-[#d7e4f8] hover:border-[#8faee3] hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
