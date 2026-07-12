export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--hairline)",
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <nav style={{ display: "flex", gap: 40 }}>
        {["Privacy", "Terms", "Contact"].map((label) => (
          <a
            key={label}
            href="#"
            className="text-[var(--slate-dim)] transition-colors hover:text-[var(--frost-700)]"
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
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--slate-dim)", opacity: 0.75 }}>© 2026 Floe</p>
    </footer>
  );
}
