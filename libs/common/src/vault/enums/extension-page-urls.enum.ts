import { UnionOfValues } from "../types/union-of-values";

/**
 * Available pages within the extension by their URL.
 * Useful when opening a specific page within the popup.
 */
export const ExtensionPageUrls: Record<string, `popup/index.html#/${string}`> = {
  Index: "popup/index.html#/",
  AtRiskPasswords: "popup/index.html#/at-risk-passwords",
  //@FIXME: replace with the real page
  AutoConfirm: "popup/index.html#/",
} as const;

export type ExtensionPageUrls = UnionOfValues<typeof ExtensionPageUrls>;
