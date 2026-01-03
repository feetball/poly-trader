import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Next.js component mocks for unit tests.
vi.mock("next/link", () => {
  return {
    default: ({ href, children, ...props }: any) => (
      <a href={typeof href === "string" ? href : href?.pathname} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("next/navigation", () => {
  return {
    usePathname: vi.fn(() => "/"),
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
