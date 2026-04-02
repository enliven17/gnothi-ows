"use client";

import { useState, useEffect } from "react";
import SplashScreen from "../components/SplashScreen";
import { AnimatePresence } from "framer-motion";

export default function RootLayoutProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  // In Next.js, we might want to check if it's the first visit, 
  // but for a simple splash screen, we can show it on every full hard reload.
  
  return (
    <>
      <AnimatePresence mode="wait">
        {loading && (
          <SplashScreen key="splash" finishLoading={() => setLoading(false)} />
        )}
      </AnimatePresence>
      <div 
        style={{ 
          opacity: loading ? 0 : 1, 
          transition: "opacity 0.5s ease-in-out",
          height: "100%",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {children}
      </div>
    </>
  );
}
