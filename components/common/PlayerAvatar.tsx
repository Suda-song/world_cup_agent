"use client";

import { useState } from "react";
import { playerPhoto } from "@/lib/data/playerPhotos";

// Deterministic accent color from a name (for the initials fallback).
function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string): string {
  // Strip a leading "X." initial, then take up to 2 leading letters of the rest.
  const clean = name.replace(/^[A-Za-z]\.\s*/, "").trim();
  const parts = clean.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export default function PlayerAvatar({
  name,
  size = 44,
  isStar = false,
}: {
  name: string;
  size?: number;
  isStar?: boolean;
}) {
  const photo = playerPhoto(name);
  const [errored, setErrored] = useState(false);
  const showPhoto = photo && !errored;

  const hue = hueFromName(name);
  const ring = isStar ? "ring-2 ring-gold/60" : "ring-1 ring-border";

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden ${ring} bg-surface-2 flex items-center justify-center`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          // sofifa CDN 403s when a Referer is sent (hotlink protection); suppress it.
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <span
          className="font-bold select-none"
          style={{
            fontSize: size * 0.36,
            color: `hsl(${hue} 70% 78%)`,
            background: `hsl(${hue} 45% 22%)`,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}
