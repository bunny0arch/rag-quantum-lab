import type { ProjectedPoint } from "@shared/types";

export const POINT_SPREAD = 1.2;

type Coordinates = Pick<ProjectedPoint, "x" | "y" | "z">;

export function toScenePosition(point: Coordinates): [number, number, number] {
  return [point.x * 2.8 * POINT_SPREAD, point.y * 2.2 * POINT_SPREAD, point.z * 2.8 * POINT_SPREAD];
}

export function toFallbackMapPosition(point: Pick<Coordinates, "x" | "y">) {
  const mapScale = 38 * POINT_SPREAD;
  return { left: 50 + point.x * mapScale, top: 50 - point.y * mapScale };
}
