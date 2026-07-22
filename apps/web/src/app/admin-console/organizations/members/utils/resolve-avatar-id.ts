export interface AvatarIdentifiable {
  id: string;
  userId?: string;
}

/**
 * Resolves a consistent avatar id for a member, preferring their account id (`userId`) and
 * falling back to the org/provider user id (e.g. for invited members with no linked account).
 */
export function resolveAvatarId(user: AvatarIdentifiable): string {
  return user.userId ?? user.id;
}
