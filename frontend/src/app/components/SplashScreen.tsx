"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen({ finishLoading }: { finishLoading: () => void }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const timeout = setTimeout(() => {
      finishLoading();
    }, 3000); // Wait for animation to finish
    return () => clearTimeout(timeout);
  }, [finishLoading]);

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="splash-overlay"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <div className="splash-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            style={{ display: 'flex', alignItems: 'center' }}
            initial={{ x: 0 }}
            animate={{ x: 0 }} // Keep it centered as it grows
          >
            {/* The 'g' letter */}
            <motion.div
              className="splash-letter"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                scale: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] },
                opacity: { duration: 0.4 }
              }}
            >g</motion.div>

            {/* The 'nothi' group */}
            <motion.div
              style={{ overflow: 'hidden', display: 'flex' }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ 
                width: "auto", 
                opacity: 1 
              }}
              transition={{ 
                delay: 1.2, 
                duration: 0.8, 
                ease: [0.76, 0, 0.24, 1]
              }}
            >
              <div className="splash-text-rest">nothi</div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
