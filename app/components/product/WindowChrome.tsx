interface WindowChromeProps {
  title?: string;
  // Replaces the centered title with arbitrary content (e.g. InstallCommand's
  // macOS/Windows toggle) — takes priority over `title` when both are passed.
  center?: React.ReactNode;
}

// macOS-style window chrome — traffic-light dots (single element, drawn via
// box-shadow rather than three separate spans) + a slightly lighter strip
// than the block's own #0A0A0A body, so real-UI blocks (Waterfall,
// ReplayDiff, LogStream) read as actual application windows, not just
// dark cards. Sits above the block's own padded content, inside the same
// .arctic-code-block wrapper — doesn't affect its hover glow, which is
// keyed off the outer element regardless of what's inside it.
export default function WindowChrome({ title, center }: WindowChromeProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        height: 34,
        padding: "0 14px",
        flexShrink: 0,
        background: "#111318",
        borderBottom: "1px solid rgba(150,190,220,0.4)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: "#FF5F57",
          boxShadow: "18px 0 0 #FEBC2E, 36px 0 0 #28C840",
          flexShrink: 0,
        }}
      />
      {center ? (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>{center}</div>
      ) : (
        title && (
          <span
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "#D4D4D4",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        )
      )}
    </div>
  );
}
