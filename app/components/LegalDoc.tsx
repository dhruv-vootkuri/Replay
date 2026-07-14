import Link from "next/link";

interface Section {
  heading: string;
  body: string[];
}

interface LegalDocProps {
  title: string;
  updated: string;
  sections: Section[];
}

// Shared layout for /privacy and /terms — plain readable typography, no
// arctic-topo/video treatment, since these are utility pages, not part of
// the one-scroll marketing narrative.
export default function LegalDoc({ title, updated, sections }: LegalDocProps) {
  return (
    <section style={{ padding: "160px 24px 140px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/"
          className="text-[var(--slate-dim)] transition-colors hover:text-[var(--frost-700)]"
          style={{
            display: "inline-block",
            marginBottom: 32,
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          ← Back to Floe
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 700,
            color: "var(--ink)",
            marginBottom: 12,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--slate-dim)",
            marginBottom: 56,
            paddingBottom: 32,
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          Last updated {updated}
        </p>

        {sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 40 }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: 14,
              }}
            >
              {s.heading}
            </h2>
            {s.body.map((p, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9375rem",
                  lineHeight: 1.7,
                  color: "var(--slate)",
                  marginBottom: i === s.body.length - 1 ? 0 : 12,
                }}
              >
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
