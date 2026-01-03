import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { usePathname } from "next/navigation";
import SideNav from "@/components/SideNav";

describe("SideNav", () => {
  it("highlights the active route", () => {
    vi.mocked(usePathname).mockReturnValue("/settings");

    render(<SideNav status={{ status: "running" }} />);

    const settingsLinks = screen.getAllByText("Settings");
    expect(settingsLinks.length).toBeGreaterThan(0);
    const settingsLink = settingsLinks[0].closest("a");
    expect(settingsLink).toBeTruthy();
    expect(settingsLink?.className).toContain("bg-blue-500/20");

    const runningElements = screen.getAllByText("Running");
    expect(runningElements.length).toBeGreaterThan(0);
  });

  it("renders stopped status when not running", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<SideNav status={{ status: "stopped" }} />);

    const stoppedElements = screen.getAllByText("Stopped");
    expect(stoppedElements.length).toBeGreaterThan(0);
  });

  it("shows mobile menu button", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<SideNav status={{ status: "running" }} />);

    const menuButton = screen.getByLabelText("Toggle menu");
    expect(menuButton).toBeInTheDocument();
  });

  it("opens and closes mobile menu", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { container } = render(<SideNav status={{ status: "running" }} />);

    const menuButton = screen.getByLabelText("Toggle menu");
    
    // Menu should be closed initially
    const mobileNav = container.querySelector('nav.-translate-x-full');
    expect(mobileNav).toBeInTheDocument();

    // Click to open
    fireEvent.click(menuButton);
    
    // Menu should be open
    const openNav = container.querySelector('nav.translate-x-0');
    expect(openNav).toBeInTheDocument();
  });
});
