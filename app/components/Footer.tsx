const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/#waitlist" },
];

export default function Footer() {
  return (
    <footer
      style={{
        padding: "28px 24px 100px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* rgba(--ink), not var(--hairline) — this sits over the atmospheric
          video, and hairline's pale blue-gray has ~zero contrast against
          the video texture (same reason this footer's text uses --ink
          instead of --slate — see globals.css / CLAUDE.md) */}
      <div style={{ width: "60%", height: 1, background: "rgba(11,14,20,0.25)", marginBottom: 8 }} />
      <nav style={{ display: "flex", gap: 40 }}>
        {FOOTER_LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="text-[var(--ink)] transition-colors hover:text-[var(--frost-700)]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              textDecoration: "none",
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--ink)" }}>© 2026 Floe</p>
    </footer>
  );
}
