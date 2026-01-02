"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiquidButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "danger" | "success";
}

export function LiquidButton({ children, className, variant = "primary", ...props }: LiquidButtonProps) {
  const variants = {
    primary: "from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400",
    danger: "from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400",
    success: "from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative px-6 py-3 rounded-xl font-bold text-white shadow-lg overflow-hidden group",
        "bg-gradient-to-r",
        variants[variant],
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-xl" />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
