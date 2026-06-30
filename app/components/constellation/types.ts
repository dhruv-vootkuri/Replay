export type StarPoint = {
  id: string;
  x: number;          // 0–1 normalized
  y: number;          // 0–1 normalized
  r?: number;         // base radius px (default 2)
  twinkle?: boolean;
  highlighted?: boolean; // accent-color glow for flagged / overlay-diff
};

export type Edge = {
  from: string;
  to: string;
  highlighted?: boolean; // accent-color stroke
};

export type ConstellationState = "unresolved" | "resolved";

export type ConstellationVariant =
  | "default"
  | "flagged"          // Insights: highlighted nodes/edges in accent
  | "overlay-diff"     // Pressure Tests: two constellations, diverging edges in accent
  | "twin-ghost"       // Sandboxes: ghost copy with dashed boundary
  | "traveling-point"; // Agent: light loops the edges

export interface ConstellationProps {
  mode?: "canvas" | "svg";
  points: StarPoint[];
  edges: Edge[];
  state?: ConstellationState;
  variant?: ConstellationVariant;
  accentColor?: string;
  // overlay-diff only
  overlayPoints?: StarPoint[];
  overlayEdges?: Edge[];
  // 0–1 resolve animation progress (canvas only). When provided, drift fades
  // out and edges fade in as it approaches 1. Omit for static state behavior.
  resolveProgress?: number;
  // When true the canvas/SVG skips its draw/animation loop.
  // Used by the scroll orchestrator to pause off-screen pages.
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
