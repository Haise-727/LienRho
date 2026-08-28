"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Marketplace" },
  { href: "/forecast", label: "Cash Forecast" },
  { href: "/approvals", label: "Approvals" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The marketplace (/) and sign-in screen (/login) handle their own integrated headers.
  if (pathname === "/" || pathname === "/login") {
    return <div className="min-h-screen bg-[#F8FAFC]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-xs">
              LR
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-[#0F172A] block leading-none">
                LienRho
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Working-capital clearinghouse
              </span>
            </div>
          </Link>
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    active
                      ? "bg-white text-[#0F172A] shadow-xs"
                      : "text-slate-600 hover:text-[#0F172A]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
