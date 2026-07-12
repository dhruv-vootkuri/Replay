interface HudReadoutProps {
  label: string;
  dotColor?: string;
  style?: React.CSSProperties;
}

// A small "STATUS: X" mono readout with a pulsing status dot — the console's
// vocabulary for telling the visitor what state a section represents.
export default function HudReadout({ label, dotColor = "#0A0A0A", style }: HudReadoutProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-mono)",
        fontSize: "0.625rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "rgba(10,10,10,0.55)",
        ...style,
      }}
    >
      <span className="dash-live-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      {label}
    </div>
  );
}
