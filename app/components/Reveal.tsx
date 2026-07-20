"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

// Scroll-triggered fade-up used across the marketing page (hero copy, KPI
// tiles, section headers, the explainer trios, the real-UI code blocks).
// Fires once per element (viewport: once) rather than replaying every time
// it re-enters view on scroll-up — repeated re-triggers read as laggy, not
// premium. Spring physics (not a duration/easing curve) so it visibly
// travels up and settles with a touch of overshoot, rather than just
// smoothly arriving — a bigger travel distance (72px, not a subtle 24px)
// so the "coming from below" motion actually reads at a glance.
export default function Reveal({ delay = 0, style, children, ...props }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 72 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 110, damping: 16, mass: 0.9, delay }}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}
