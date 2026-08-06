"use client";

import { useState } from "react";
import { getInitials } from "@/lib/family-format";

type PersonAvatarProps = {
  name: string;
  color: string;
  photoUrl?: string | null;
  /** Extra class alongside "avatar", e.g. "avatar-large" or "quick-avatar" — matches the size variants in globals.css. */
  className?: string;
};

/**
 * A relative's photo, or their initials on a solid color when there's no
 * photo (or it fails to load) — the same "avatar" look used throughout the
 * app, just with the image-vs-initials decision centralized in one place.
 */
export function PersonAvatar({ name, color, photoUrl, className }: PersonAvatarProps) {
  const [failed, setFailed] = useState(false);
  const classes = className ? `avatar ${className}` : "avatar";

  if (photoUrl && !failed) {
    return (
      <span className={classes} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI stored per-relative, not a local/remote asset Next can optimize. */}
        <img src={photoUrl} alt="" onError={() => setFailed(true)} />
      </span>
    );
  }

  return (
    <span className={classes} style={{ backgroundColor: color }} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
