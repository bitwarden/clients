import {
  AutofillOverlayVisibility,
  AutofillTargetingRuleTypes,
  BrowserClientVendors,
  BrowserShortcutsUris,
  ClearClipboardDelay,
  DisablePasswordManagerUris,
} from "../constants";

export type AutofillTargetingRuleType =
  (typeof AutofillTargetingRuleTypes)[keyof typeof AutofillTargetingRuleTypes];

/**
 * Maps a field type to its CSS query selector string.
 * Each entry identifies a specific form field on a page using a CSS selector.
 * Supports shadow DOM piercing via the `>>>` separator syntax.
 */
export type AutofillTargetingRules = {
  [type in AutofillTargetingRuleType]?: string;
};

/**
 * Maps a normalized URL (hostname + path, protocol is assumed) to the targeting rules
 * for that page. The URL key is normalized by stripping query strings and fragments.
 */
export type AutofillTargetingRulesByDomain = {
  [normalizedUrl: string]: AutofillTargetingRules;
};

export type ClearClipboardDelaySetting =
  (typeof ClearClipboardDelay)[keyof typeof ClearClipboardDelay];

export type InlineMenuVisibilitySetting =
  (typeof AutofillOverlayVisibility)[keyof typeof AutofillOverlayVisibility];

export type BrowserClientVendor = (typeof BrowserClientVendors)[keyof typeof BrowserClientVendors];
export type BrowserShortcutsUri = (typeof BrowserShortcutsUris)[keyof typeof BrowserShortcutsUris];
export type DisablePasswordManagerUri =
  (typeof DisablePasswordManagerUris)[keyof typeof DisablePasswordManagerUris];
