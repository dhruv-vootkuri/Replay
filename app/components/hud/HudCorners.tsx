// Corner-bracket frame accents shared by every HUD-styled section — the
// trace-console chrome established in the hero-demo prototype and CLAUDE.md.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface HudCornersProps {
  color?: string;
  size?: number;
  inset?: number;
}

export default function HudCorners({ color = "#0A0A0A", size = 32, inset = 0 }: HudCornersProps) {
  const borderColor = hexToRgba(color, 0.45);
  const base: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    zIndex: 20,
    pointerEvents: "none",
  };
  return (
    <>
      <div style={{ ...base, top: inset, left: inset, borderTop: `2px solid ${borderColor}`, borderLeft: `2px solid ${borderColor}` }} />
      <div style={{ ...base, top: inset, right: inset, borderTop: `2px solid ${borderColor}`, borderRight: `2px solid ${borderColor}` }} />
      <div style={{ ...base, bottom: inset, left: inset, borderBottom: `2px solid ${borderColor}`, borderLeft: `2px solid ${borderColor}` }} />
      <div style={{ ...base, bottom: inset, right: inset, borderBottom: `2px solid ${borderColor}`, borderRight: `2px solid ${borderColor}` }} />
    </>
  );
}
