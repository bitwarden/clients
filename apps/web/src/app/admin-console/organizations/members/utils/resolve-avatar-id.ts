/**
 * Minimal shape needed to resolve a consistent avatar identifier for a member.
 */
export interface AvatarIdentifiable {
  id: string;
  userId?: string;
}

/**
 * Resolve the identifier used by `bit-avatar` to deterministically color a member's avatar when
 * no explicit `avatarColor` is set.
 *
 * Always prefer the account id (`userId`) so the same member shows the same avatar color
 * everywhere they appear (e.g. the members list and bulk action dialogs). Fall back to the
 * org/provider user id for members who don't yet have a linked account (e.g. invited or staged
 * members), since they have no `userId`.
 *
 * This must be used consistently everywhere a member's avatar is rendered - using different
 * fallback logic in different places causes the same member to show different avatar colors.
 */
export function resolveAvatarId(user: AvatarIdentifiable): string {
  return user.userId ?? user.id;
}
