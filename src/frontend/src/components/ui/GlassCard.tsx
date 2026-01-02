"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassCard({ children, className, hoverEffect = false }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverEffect ? { scale: 1.02, boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)" } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl",
        "before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-br before:from-white/5 before:to-transparent",
        className
      )}
    >
      {/* Liquid reflection effect */}
      <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-br from-transparent via-white/5 to-transparent rotate-45 pointer-events-none" />
      {children}
    </motion.div>
  );
}
