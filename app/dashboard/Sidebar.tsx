"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (p: string) => boolean;
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    match: (p) => p === "/dashboard",
    icon: <Icon d="M3 12l9-9 9 9M5 10v10h14V10" />,
  },
  {
    href: "/dashboard/traces",
    label: "Traces",
    match: (p) => p.startsWith("/dashboard/traces"),
    icon: <Icon d="M4 6h16M4 12h16M4 18h10" />,
  },
  {
    href: "/dashboard/replays",
    label: "Replays",
    match: (p) => p.startsWith("/dashboard/replays"),
    icon: <Icon d="M3 12a9 9 0 109-9 9 9 0 00-9 9zm0 0l3-3m-3 3l3 3M12 7v5l3 2" />,
  },
  {
    href: "/dashboard/logs",
    label: "Logs",
    match: (p) => p.startsWith("/dashboard/logs"),
    icon: <Icon d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" />,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[236px] flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#0B1120]">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-3 px-6 py-5">
        <span className="relative flex h-8 w-8 items-center justify-center">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <circle cx="6" cy="9" r="1.6" fill="#38BDF8" />
            <circle cx="15" cy="5" r="1.6" fill="#38BDF8" />
            <circle cx="23" cy="11" r="1.6" fill="#38BDF8" />
            <circle cx="12" cy="16" r="1.6" fill="#38BDF8" />
            <circle cx="20" cy="22" r="1.6" fill="#38BDF8" />
            <path d="M6 9l9-4 8 6-11 5 8 6" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.5" fill="none" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="leading-tight">
          <div className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-starlight">
            Floe
          </div>
          <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-dim-starlight/60">
            replay console
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-signal/10 text-starlight"
                  : "text-dim-starlight hover:bg-white/[0.04] hover:text-starlight"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-signal" />
              )}
              <span className={active ? "text-signal" : "text-dim-starlight/70 group-hover:text-dim-starlight"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="border-t border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2 text-xs text-dim-starlight">
          <span className="dash-live-dot h-2 w-2 rounded-full bg-pulse" />
          Tracer connected
        </div>
        <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-dim-starlight/50">
          traces/ · local sink
        </div>
        <Link
          href="/"
          className="mt-3 inline-flex items-center gap-1 text-[11px] text-dim-starlight/60 transition-colors hover:text-signal"
        >
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}
