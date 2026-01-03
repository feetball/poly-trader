import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("supports conditional classes", () => {
    expect(cn("text-white", false && "hidden", "opacity-50")).toBe(
      "text-white opacity-50"
    );
  });
});
