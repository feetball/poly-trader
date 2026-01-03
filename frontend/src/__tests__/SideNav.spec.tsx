import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import SideNav from "@/components/SideNav";

describe("SideNav", () => {
  it("highlights the active route", () => {
    vi.mocked(usePathname).mockReturnValue("/settings");

    render(<SideNav status={{ status: "running" }} />);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).toBeTruthy();
    expect(settingsLink?.className).toContain("bg-blue-500/20");

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("renders stopped status when not running", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<SideNav status={{ status: "stopped" }} />);

    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });
});
