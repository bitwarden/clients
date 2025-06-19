import { UnionOfValues } from "../types/union-of-values";

/**
 * Available pages within the popup by their URL.
 * Useful when opening a specific page within the popup.
 */
export const PopupPageUrls: Record<string, `popup/index.html#/${string}`> = {
  Default: "popup/index.html#/",
  AtRiskPasswords: "popup/index.html#/at-risk-passwords",
} as const;

export type PopupPageUrls = UnionOfValues<typeof PopupPageUrls>;
