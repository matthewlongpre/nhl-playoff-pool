"use client";

import { useCallback, useState } from "react";
import { dominantRgbFromImageData } from "@/lib/pool/owner-avatar-backdrop";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";

type Props = {
  filename: string | undefined;
  width: number;
  height: number;
  className?: string;
};

const SAMPLE_W = 32;
const SAMPLE_H = 32;

const backdropBySrc = new Map<string, string>();

function sampleBackdropFromImg(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);
    const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
    return dominantRgbFromImageData(data, SAMPLE_W, SAMPLE_H);
  } catch {
    return null;
  }
}

/**
 * Local roster avatars: native `img` + canvas-derived backdrop so letterboxing
 * from `object-cover` matches the photo instead of a flat zinc ring.
 */
export function OwnerAvatarImage({ filename, width, height, className }: Props) {
  const src = ownerAvatarSrc(filename);
  const [backdrop, setBackdrop] = useState<string | null>(() =>
    src ? backdropBySrc.get(src) ?? null : null,
  );

  const onLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!src) return;
      const cached = backdropBySrc.get(src);
      if (cached) {
        setBackdrop(cached);
        return;
      }
      const color = sampleBackdropFromImg(e.currentTarget);
      if (color) {
        backdropBySrc.set(src, color);
        setBackdrop(color);
      }
    },
    [src],
  );

  if (!src) return null;

  const imgClass = [className, "relative z-[1]"].filter(Boolean).join(" ");

  return (
    <div className="relative isolate h-full w-full">
      {backdrop ? (
        <span
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundColor: backdrop }}
          aria-hidden
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- canvas readback needs HTMLImageElement; local unoptimized assets */}
      <img
        src={src}
        alt=""
        width={width}
        height={height}
        className={imgClass}
        onLoad={onLoad}
        decoding="async"
      />
    </div>
  );
}
