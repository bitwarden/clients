/** The five default avatar colors, in palette order. */
export const AvatarDefaultColors = ["teal", "coral", "brand", "green", "purple"] as const;

export type AvatarColor = (typeof AvatarDefaultColors)[number];

/**
 * Palette avatar colors. Prefer these over custom colors; they're chosen for cohesion with the
 * Bitwarden palette and for contrast.
 */
export const defaultAvatarColors: Record<AvatarColor, string> = {
  teal: "#007c95",
  coral: "#c71800",
  brand: "#175ddc",
  green: "#008236",
  purple: "#8200db",
};

/** Hover colors for each default avatar color, used when the avatar is interactive. */
export const defaultAvatarHoverColors: Record<AvatarColor, string> = {
  teal: "#006278",
  coral: "#a81400",
  brand: "#0d43af",
  green: "#016630",
  purple: "#6e11b0",
};

export function isAvatarColor(color: string | undefined): color is AvatarColor {
  return color !== undefined && (AvatarDefaultColors as readonly string[]).includes(color);
}

/**
 * Deterministically maps an id or display-name key to one of the default avatar colors.
 * The id takes precedence over text when both are provided.
 */
export function getAvatarDefaultColor(id?: string, text?: string): AvatarColor {
  const seed = id?.trim() ? id : (text?.toUpperCase() ?? "");
  let hash = 0;
  for (const char of seed) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return AvatarDefaultColors[Math.abs(hash) % AvatarDefaultColors.length];
}

/**
 * Picks black or white text for a hex background. Same calculation as
 * `Utils.pickTextColorBasedOnBgColor` in `@bitwarden/common`.
 */
export function pickTextColor(bgColor: string, threshold = 186): "black" | "white" {
  const hex = bgColor.charAt(0) === "#" ? bgColor.substring(1, 7) : bgColor;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > threshold ? "black" : "white";
}
