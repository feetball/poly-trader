import { describe, expect, it } from "vitest";
import { Strategy } from "../strategies/base";

describe("Strategy base", () => {
  it("can be extended and analyzed", async () => {
    class TestStrategy extends Strategy {
      id = "t";
      name = "Test";
      description = "Test";
      async analyze() {
        return [];
      }
    }

    const s = new TestStrategy();
    expect(s.id).toBe("t");
    const res = await s.analyze({} as any);
    expect(res).toEqual([]);
  });
});
