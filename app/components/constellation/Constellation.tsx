import type { ConstellationProps } from "./types";
import ConstellationCanvas from "./ConstellationCanvas";
import ConstellationSVG from "./ConstellationSVG";

export default function Constellation({ mode = "canvas", ...props }: ConstellationProps) {
  return mode === "canvas"
    ? <ConstellationCanvas {...props} />
    : <ConstellationSVG {...props} />;
}

export type { ConstellationProps, StarPoint, Edge, ConstellationState, ConstellationVariant } from "./types";
