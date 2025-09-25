export const BadgeStateScope = {
  /**
   * The state is global and applies to all users.
   */
  Global: { type: "global" } satisfies BadgeStateScope,
  /**
   * The state is for a specific user and only applies to that user when they are unlocked.
   */
  UserUnlocked: (userId: string) =>
    ({
      type: "user_unlocked",
      userId,
    }) satisfies BadgeStateScope,
} as const;

export type BadgeStateScope =
  | {
      type: "global";
    }
  | {
      type: "user_unlocked";
      userId: string;
    };
