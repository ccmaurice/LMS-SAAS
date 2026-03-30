"use client";

import { useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Avoid SSR/client mismatch: `useReducedMotion()` is unreliable during SSR, and Framer Motion's
 * `initial` styles differ from the static server tree. Render a static shell until mounted, then animate.
 */
export function OrgPageTransition({ children }: { children: React.ReactNode }) {
  const mounted = useIsClient();
  const reduce = useReducedMotion();

  if (!mounted || reduce) {
    return <div className="relative">{children}</div>;
  }

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
