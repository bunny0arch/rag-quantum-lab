import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type NavItem = { id: string; label: string };

const items: NavItem[] = [
  { id: "sources", label: "Sources" },
  { id: "universe", label: "Universe" },
  { id: "retrieval", label: "Retrieval" },
  { id: "method", label: "Method" },
];

export function AdaptiveNav({ activeId }: { activeId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [displayId, setDisplayId] = useState(activeId);

  useEffect(() => {
    setDisplayId(activeId);
    setExpanded(true);
    const timeout = window.setTimeout(() => setExpanded(false), 900);
    return () => window.clearTimeout(timeout);
  }, [activeId]);

  return (
    <motion.nav
      className="adaptive-nav"
      animate={{ width: expanded ? 420 : 154 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Workspace sections"
    >
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button
            key={displayId}
            className="adaptive-nav__active"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onClick={() => document.getElementById(displayId)?.scrollIntoView({ behavior: "smooth" })}
          >
            <span className="nav-pulse" />
            {items.find(item => item.id === displayId)?.label || "Workspace"}
          </motion.button>
        ) : (
          <motion.div className="adaptive-nav__items" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {items.map(item => (
              <button
                key={item.id}
                className={item.id === activeId ? "is-active" : ""}
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
