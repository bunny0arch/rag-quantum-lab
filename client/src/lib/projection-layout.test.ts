import { describe, expect, it } from "vitest";
import { POINT_SPREAD, toFallbackMapPosition, toScenePosition } from "./projection-layout";

describe("embedding projection layout", () => {
  it("spreads scene coordinates uniformly without changing the source projection", () => {
    expect(POINT_SPREAD).toBe(1.2);
    const [x, y, z] = toScenePosition({ x: 0.5, y: -0.5, z: 0.25 });
    expect(x).toBeCloseTo(0.5 * 2.8 * POINT_SPREAD);
    expect(y).toBeCloseTo(-0.5 * 2.2 * POINT_SPREAD);
    expect(z).toBeCloseTo(0.25 * 2.8 * POINT_SPREAD);
  });

  it("keeps maximally spread 2D points inside the fallback map", () => {
    const leftTop = toFallbackMapPosition({ x: -1, y: 1 });
    const rightBottom = toFallbackMapPosition({ x: 1, y: -1 });
    expect(leftTop.left).toBeCloseTo(4.4);
    expect(leftTop.top).toBeCloseTo(4.4);
    expect(rightBottom.left).toBeCloseTo(95.6);
    expect(rightBottom.top).toBeCloseTo(95.6);
  });
});
