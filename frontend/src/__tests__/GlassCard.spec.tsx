import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlassCard } from "@/components/ui/GlassCard";

describe("GlassCard", () => {
  it("renders children with hoverEffect disabled", () => {
    render(<GlassCard hoverEffect={false}>Hello</GlassCard>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
