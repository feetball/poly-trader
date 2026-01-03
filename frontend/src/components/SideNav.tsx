"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Settings, Briefcase, FileText, Menu, X } from "lucide-react";
import { useState } from "react";

interface SideNavProps {
  status: { status: string };
}

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/positions", label: "Positions", icon: Briefcase },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/logs", label: "Logs", icon: FileText },
];

export default function SideNav({ status }: SideNavProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const renderNavContent = () => (
    <>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={closeMobileMenu}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200
              ${
                isActive
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-200"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        );
      })}

      {/* Status indicator */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Status</div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <span
            className={`w-2 h-2 rounded-full ${
              status?.status === "running"
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "bg-rose-500"
            }`}
          />
          <span className="text-xs text-white/60">
            {status?.status === "running" ? "Running" : "Stopped"}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-6 left-6 z-50 p-3 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md hover:bg-white/20 transition-all duration-200"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Menu className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <nav
        className={`
          lg:hidden fixed top-0 left-0 bottom-0 z-40 w-64 bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/10
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col gap-2 p-6 pt-24">
          {renderNavContent()}
        </div>
      </nav>

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex flex-col gap-2 h-fit sticky top-8">
        {renderNavContent()}
      </nav>
    </>
  );
}
