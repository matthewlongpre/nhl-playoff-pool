import Image from "next/image";
import {
  nhleIsTbdPlaceholderLogoUrl,
  nhleTeamLogoDarkSrcIfLight,
  nhleTeamLogoInvertOnTeamPrimaryBg,
} from "@/lib/nhl/media";

type Props = {
  src: string;
  width: number;
  height: number;
  className?: string;
  alt?: string;
  unoptimized?: boolean;
  /** Crest sits on that club's primary hex fill; use inverse mark in light UI when the light asset lacks contrast (e.g. TBL on navy). */
  onTeamPrimaryBackground?: boolean;
};

/**
 * NHLE team marks ship as `*_light.svg` (dark ink) and `*_dark.svg` (light ink).
 * In `dark` mode we swap so crests stay legible on zinc backgrounds.
 */
export function NhleTeamLogoImage({
  src,
  width,
  height,
  className = "",
  alt = "",
  unoptimized = true,
  onTeamPrimaryBackground = false,
}: Props) {
  if (nhleIsTbdPlaceholderLogoUrl(src)) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-md bg-[#2a2a2a] text-[0.95rem] font-light leading-none text-zinc-500/80 select-none ${className}`.trim()}
        style={{ width, height }}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        ?
      </span>
    );
  }

  const darkSrc = nhleTeamLogoDarkSrcIfLight(src);
  const img = `max-h-full max-w-full object-contain ${className}`.trim();

  const inverseOnPrimary =
    onTeamPrimaryBackground &&
    darkSrc != null &&
    nhleTeamLogoInvertOnTeamPrimaryBg(src);

  if (inverseOnPrimary) {
    /**
     * Wrap in a fixed-size grid cell so the image has a definite containing block
     * (matches the default light/dark grid path). Without this wrapper, callers that
     * place the logo inside auto-sized `inline-flex` chains (e.g. the team-mix bars)
     * collapse `max-h-full` / `max-h-[Npx]` and the image renders at zero height.
     */
    return (
      <span
        className="inline-grid shrink-0 grid-cols-1 grid-rows-1 place-items-center"
        style={{ width, height }}
      >
        <Image
          src={darkSrc}
          alt={alt}
          width={width}
          height={height}
          className={img}
          unoptimized={unoptimized}
        />
      </span>
    );
  }

  if (!darkSrc) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={img}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    <span
      className="inline-grid shrink-0 grid-cols-1 grid-rows-1 place-items-center"
      style={{ width, height }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${img} col-start-1 row-start-1 dark:hidden`}
        unoptimized={unoptimized}
      />
      <Image
        src={darkSrc}
        alt={alt}
        width={width}
        height={height}
        className={`${img} col-start-1 row-start-1 hidden dark:block`}
        unoptimized={unoptimized}
      />
    </span>
  );
}
