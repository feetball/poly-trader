"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "neutral";
  isLoading?: boolean;
}

export function LiquidButton({ children, className, variant = "primary", isLoading, ...props }: LiquidButtonProps) {
  const variants = {
    primary: "bg-blue-600/80 hover:bg-blue-500/90 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)]",
    danger: "bg-red-600/80 hover:bg-red-500/90 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]",
    neutral: "bg-white/10 hover:bg-white/20 text-white border border-white/10",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "relative px-6 py-3 rounded-xl font-bold backdrop-blur-md transition-all duration-300",
        "overflow-hidden group",
        variants[variant],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:animate-shimmer" />
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          <span>Processing...</span>
        </div>
      ) : (
        children
      )}
    </motion.button>
  );
}
