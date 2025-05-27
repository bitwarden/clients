export const BadgeIcon = {
  LoggedOut: {
    19: "/images/icon19_gray.png",
    38: "/images/icon38_gray.png",
  } as IconPaths,
  Locked: {
    19: "/images/icon19_locked.png",
    38: "/images/icon38_locked.png",
  } as IconPaths,
  Unlocked: {
    19: "/images/icon19.png",
    38: "/images/icon38.png",
  } as IconPaths,
} as const satisfies Record<string, IconPaths>;

export type BadgeIcon = (typeof BadgeIcon)[keyof typeof BadgeIcon];

export type IconPaths = {
  19: string;
  38: string;
};
