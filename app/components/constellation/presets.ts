import type { StarPoint, Edge } from "./types";

// — Landing: a winding guide-path (10 stars)
export const heroPoints: StarPoint[] = [
  { id: "h1",  x: 0.15, y: 0.28, r: 1.8, twinkle: true },
  { id: "h2",  x: 0.29, y: 0.18, r: 2.2 },
  { id: "h3",  x: 0.46, y: 0.22, r: 2.5, twinkle: true },
  { id: "h4",  x: 0.60, y: 0.16, r: 1.8 },
  { id: "h5",  x: 0.74, y: 0.28, r: 2.2, twinkle: true },
  { id: "h6",  x: 0.68, y: 0.43, r: 1.8 },
  { id: "h7",  x: 0.54, y: 0.53, r: 2.5 },
  { id: "h8",  x: 0.40, y: 0.63, r: 2.0, twinkle: true },
  { id: "h9",  x: 0.26, y: 0.70, r: 1.8 },
  { id: "h10", x: 0.40, y: 0.80, r: 2.2, twinkle: true },
];
export const heroEdges: Edge[] = [
  { from: "h1", to: "h2" }, { from: "h2", to: "h3" },
  { from: "h3", to: "h4" }, { from: "h4", to: "h5" },
  { from: "h5", to: "h6" }, { from: "h6", to: "h7" },
  { from: "h7", to: "h8" }, { from: "h8", to: "h9" },
  { from: "h9", to: "h10" },
  { from: "h3", to: "h7" }, // cross-brace
  { from: "h2", to: "h8" }, // cross-brace
];

// — Problem: many crossing edges (illegible tangle)
export const problemPoints: StarPoint[] = [
  { id: "pr1", x: 0.18, y: 0.22, r: 1.8, twinkle: true },
  { id: "pr2", x: 0.76, y: 0.18, r: 2.0 },
  { id: "pr3", x: 0.50, y: 0.50, r: 2.2, twinkle: true },
  { id: "pr4", x: 0.22, y: 0.72, r: 1.8 },
  { id: "pr5", x: 0.82, y: 0.65, r: 2.0, twinkle: true },
  { id: "pr6", x: 0.08, y: 0.48, r: 1.6 },
  { id: "pr7", x: 0.60, y: 0.32, r: 2.0 },
  { id: "pr8", x: 0.38, y: 0.18, r: 1.8, twinkle: true },
  { id: "pr9", x: 0.88, y: 0.38, r: 1.6 },
  { id: "pr10",x: 0.32, y: 0.84, r: 2.0 },
  { id: "pr11",x: 0.66, y: 0.78, r: 1.8, twinkle: true },
  { id: "pr12",x: 0.45, y: 0.35, r: 1.6 },
];
// Intentionally tangled — long-range, crossing edges
export const problemEdges: Edge[] = [
  { from: "pr1",  to: "pr5"  },
  { from: "pr2",  to: "pr4"  },
  { from: "pr1",  to: "pr9"  },
  { from: "pr2",  to: "pr10" },
  { from: "pr3",  to: "pr6"  },
  { from: "pr8",  to: "pr5"  },
  { from: "pr7",  to: "pr4"  },
  { from: "pr6",  to: "pr9"  },
  { from: "pr2",  to: "pr6"  },
  { from: "pr1",  to: "pr7"  },
  { from: "pr8",  to: "pr3"  },
  { from: "pr10", to: "pr7"  },
  { from: "pr11", to: "pr1"  },
  { from: "pr12", to: "pr5"  },
  { from: "pr4",  to: "pr9"  },
  { from: "pr3",  to: "pr11" },
];

// — Insights: clean shape with one anomaly cluster (flagged variant)
export const insightsPoints: StarPoint[] = [
  { id: "in1", x: 0.20, y: 0.25, r: 2.0 },
  { id: "in2", x: 0.45, y: 0.18, r: 2.2 },
  { id: "in3", x: 0.72, y: 0.22, r: 2.0 },
  { id: "in4", x: 0.82, y: 0.50, r: 2.0 },
  { id: "in5", x: 0.68, y: 0.72, r: 2.5, highlighted: true, twinkle: true },
  { id: "in6", x: 0.44, y: 0.78, r: 2.2, highlighted: true, twinkle: true },
  { id: "in7", x: 0.22, y: 0.65, r: 2.0 },
  { id: "in8", x: 0.14, y: 0.42, r: 1.8 },
  { id: "in9", x: 0.56, y: 0.56, r: 2.2, highlighted: true, twinkle: true },
];
export const insightsEdges: Edge[] = [
  { from: "in1", to: "in2" }, { from: "in2", to: "in3" },
  { from: "in3", to: "in4" }, { from: "in7", to: "in8" },
  { from: "in8", to: "in1" },
  // Anomaly cluster
  { from: "in4", to: "in5", highlighted: true },
  { from: "in5", to: "in6", highlighted: true },
  { from: "in6", to: "in9", highlighted: true },
  { from: "in9", to: "in5", highlighted: true },
];

// — Pressure Tests: original trace + replay trace (overlay-diff variant)
export const pressurePoints: StarPoint[] = [
  { id: "pt1", x: 0.20, y: 0.30, r: 2.0 },
  { id: "pt2", x: 0.42, y: 0.20, r: 2.2, twinkle: true },
  { id: "pt3", x: 0.66, y: 0.22, r: 2.0 },
  { id: "pt4", x: 0.78, y: 0.48, r: 2.2 },
  { id: "pt5", x: 0.58, y: 0.70, r: 2.0, twinkle: true },
  { id: "pt6", x: 0.30, y: 0.68, r: 2.0 },
];
export const pressureEdges: Edge[] = [
  { from: "pt1", to: "pt2" }, { from: "pt2", to: "pt3" },
  { from: "pt3", to: "pt4" }, { from: "pt4", to: "pt5" },
  { from: "pt5", to: "pt6" }, { from: "pt6", to: "pt1" },
  { from: "pt2", to: "pt5" },
];
// Overlay: mostly same path but two diverging edges
export const pressureOverlayPoints: StarPoint[] = [
  { id: "pt4b", x: 0.82, y: 0.42, r: 1.8 }, // pt4 drifted
  { id: "pt5b", x: 0.54, y: 0.78, r: 1.8 }, // pt5 drifted
];
export const pressureOverlayEdges: Edge[] = [
  { from: "pt1",  to: "pt2" },
  { from: "pt2",  to: "pt3" },
  { from: "pt3",  to: "pt4b", highlighted: true }, // diverges here
  { from: "pt4b", to: "pt5b", highlighted: true },
  { from: "pt5b", to: "pt6",  highlighted: true },
  { from: "pt6",  to: "pt1" },
];

// — Sandboxes: a compact pentagon + spoke (twin-ghost variant)
export const sandboxPoints: StarPoint[] = [
  { id: "sb1", x: 0.34, y: 0.22, r: 2.0, twinkle: true },
  { id: "sb2", x: 0.60, y: 0.22, r: 2.0 },
  { id: "sb3", x: 0.76, y: 0.46, r: 2.2 },
  { id: "sb4", x: 0.62, y: 0.70, r: 2.0, twinkle: true },
  { id: "sb5", x: 0.34, y: 0.70, r: 2.0 },
  { id: "sb6", x: 0.22, y: 0.46, r: 2.2 },
  { id: "sb7", x: 0.48, y: 0.46, r: 2.5 }, // center hub
];
export const sandboxEdges: Edge[] = [
  { from: "sb1", to: "sb2" }, { from: "sb2", to: "sb3" },
  { from: "sb3", to: "sb4" }, { from: "sb4", to: "sb5" },
  { from: "sb5", to: "sb6" }, { from: "sb6", to: "sb1" },
  { from: "sb7", to: "sb1" }, { from: "sb7", to: "sb3" },
  { from: "sb7", to: "sb5" },
];

// — Agent: circuit loop with hub (traveling-point variant)
export const agentPoints: StarPoint[] = [
  { id: "ag1", x: 0.30, y: 0.20, r: 2.0, twinkle: true },
  { id: "ag2", x: 0.62, y: 0.22, r: 2.2 },
  { id: "ag3", x: 0.80, y: 0.48, r: 2.0 },
  { id: "ag4", x: 0.66, y: 0.74, r: 2.2, twinkle: true },
  { id: "ag5", x: 0.36, y: 0.76, r: 2.0 },
  { id: "ag6", x: 0.18, y: 0.50, r: 2.0 },
  { id: "ag7", x: 0.48, y: 0.48, r: 2.5 }, // hub
];
// Ordered for smooth traversal
export const agentEdges: Edge[] = [
  { from: "ag7", to: "ag1" }, { from: "ag1", to: "ag2" },
  { from: "ag2", to: "ag7" }, { from: "ag7", to: "ag3" },
  { from: "ag3", to: "ag4" }, { from: "ag4", to: "ag7" },
  { from: "ag7", to: "ag5" }, { from: "ag5", to: "ag6" },
  { from: "ag6", to: "ag7" },
];
