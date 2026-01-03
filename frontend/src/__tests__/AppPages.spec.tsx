import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/MarketScanner", () => ({
  default: () => <div>Mock MarketScanner</div>,
}));
vi.mock("@/components/PortfolioTable", () => ({
  default: () => <div>Mock PortfolioTable</div>,
}));
vi.mock("@/components/SettingsPanel", () => ({
  default: () => <div>Mock SettingsPanel</div>,
}));

describe("App router pages", () => {
  it("renders the home page", async () => {
    const Home = (await import("@/app/page")).default;
    render(<Home />);

    expect(screen.getByText("Mock MarketScanner")).toBeInTheDocument();
    expect(screen.getByText("Mock PortfolioTable")).toBeInTheDocument();
    expect(screen.getByText(/Metric 1/i)).toBeInTheDocument();
  });

  it("renders settings page", async () => {
    const SettingsPage = (await import("@/app/settings/page")).default;
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Mock SettingsPanel")).toBeInTheDocument();
  });

  it("renders positions page", async () => {
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(screen.getByText(/Current Positions/i)).toBeInTheDocument();
    expect(screen.getByText("Mock PortfolioTable")).toBeInTheDocument();
  });
});
