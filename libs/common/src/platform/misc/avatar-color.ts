import { Utils } from "./utils";

/**
 * The five default avatar colors, in palette order. Both the Avatar component and any
 * feature that needs to mirror the avatar color (e.g. vault-nav icon tiles) import from
 * this single source so the palette and hash algorithm cannot silently diverge.
 */
export const avatarDefaultColors = ["teal", "coral", "brand", "green", "purple"] as const;
export type AvatarDefaultColor = (typeof avatarDefaultColors)[number];

/**
 * Deterministically maps an id or display-name key to one of the default avatar colors.
 * The id takes precedence over text when both are provided.
 *
 * This is the canonical implementation — AvatarComponent.getDefaultColorKey delegates here.
 */
export function getAvatarDefaultColor(id?: string, text?: string): AvatarDefaultColor {
  const seed = !Utils.isNullOrWhitespace(id) ? id! : (text?.toUpperCase() ?? "");
  let hash = 0;
  for (const char of seed) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return avatarDefaultColors[Math.abs(hash) % avatarDefaultColors.length];
}
