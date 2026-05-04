import { describe, expect, it } from "vitest";
import { dominantRgbFromImageData } from "./owner-avatar-backdrop";

function rgbaBuffer(
  width: number,
  height: number,
  fill: [number, number, number, number],
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = fill[0]!;
    buf[i + 1] = fill[1]!;
    buf[i + 2] = fill[2]!;
    buf[i + 3] = fill[3]!;
  }
  return buf;
}

describe("dominantRgbFromImageData", () => {
  it("returns averaged rgb for a flat color", () => {
    const data = rgbaBuffer(4, 4, [200, 40, 40, 255]);
    expect(dominantRgbFromImageData(data, 4, 4)).toBe("rgb(200 40 40)");
  });

  it("ignores transparent pixels", () => {
    const w = 2;
    const h = 2;
    const data = new Uint8ClampedArray(w * h * 4);
    data.set([0, 0, 255, 0], 0);
    data.set([0, 0, 255, 0], 4);
    data.set([10, 10, 250, 255], 8);
    data.set([10, 10, 250, 255], 12);
    expect(dominantRgbFromImageData(data, w, h)).toBe("rgb(10 10 250)");
  });

  it("picks the more common bucket when two colors compete", () => {
    const w = 3;
    const h = 3;
    const data = new Uint8ClampedArray(w * h * 4);
    const red: [number, number, number, number] = [240, 20, 20, 255];
    const blue: [number, number, number, number] = [20, 40, 240, 255];
    let o = 0;
    for (let i = 0; i < 6; i++) {
      data.set(red, o);
      o += 4;
    }
    for (let i = 0; i < 3; i++) {
      data.set(blue, o);
      o += 4;
    }
    expect(dominantRgbFromImageData(data, w, h)).toBe("rgb(240 20 20)");
  });

  it("returns null when everything is transparent", () => {
    const data = rgbaBuffer(2, 2, [99, 99, 99, 0]);
    expect(dominantRgbFromImageData(data, 2, 2)).toBeNull();
  });
});
