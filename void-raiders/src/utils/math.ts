// Vectores 2D, distancia, ángulos, lerp, random range

import type { Vec2 } from "../types";

export const TAU = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(distanceSq(ax, ay, bx, by));
}

export function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Devuelve un vector unitario en la dirección (x, y). (0,0) → (0,0). */
export function normalize(x: number, y: number): Vec2 {
  const len = length(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function vecFromAngle(angle: number, magnitude = 1): Vec2 {
  return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude };
}

/** Interpola un ángulo por el camino más corto. */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % TAU;
  if (diff < -Math.PI) diff += TAU;
  if (diff > Math.PI) diff -= TAU;
  return a + diff * t;
}
