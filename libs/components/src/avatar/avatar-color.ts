import { Utils } from "@bitwarden/common/platform/misc/utils";

/** The five default avatar colors, in palette order. */
export const AvatarDefaultColors = ["teal", "coral", "brand", "green", "purple"] as const;
export type AvatarColor = (typeof AvatarDefaultColors)[number];

/**
 * Deterministically maps an id or display-name key to one of the default avatar colors.
 * The id takes precedence over text when both are provided.
 */
export function getAvatarDefaultColor(id?: string, text?: string): AvatarColor {
  const seed = !Utils.isNullOrWhitespace(id) ? id! : (text?.toUpperCase() ?? "");
  let hash = 0;
  for (const char of seed) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return AvatarDefaultColors[Math.abs(hash) % AvatarDefaultColors.length];
}
