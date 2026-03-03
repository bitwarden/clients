export type DialogSize = "small" | "default" | "large";

export const dialogSizeToWidth = {
  small: "md:tw-max-w-sm",
  default: "md:tw-max-w-xl",
  large: "md:tw-max-w-3xl",
} as const;

export const drawerSizeToWidth = {
  small: "md:tw-max-w-sm",
  default: "md:tw-max-w-lg",
  large: "md:tw-max-w-2xl",
} as const;

/** Width in rem for each drawer size, used to declare push-mode column widths. */
export const drawerSizeToWidthRem: Record<string, number> = {
  small: 24,
  default: 32,
  large: 42,
};
