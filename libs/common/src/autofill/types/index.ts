import {
  AutofillFieldQualifier,
  AutofillOverlayVisibility,
  BrowserClientVendors,
  BrowserShortcutsUris,
  ClearClipboardDelay,
  DisablePasswordManagerUris,
} from "../constants";

export type ClearClipboardDelaySetting =
  (typeof ClearClipboardDelay)[keyof typeof ClearClipboardDelay];

export type InlineMenuVisibilitySetting =
  (typeof AutofillOverlayVisibility)[keyof typeof AutofillOverlayVisibility];

export type BrowserClientVendor = (typeof BrowserClientVendors)[keyof typeof BrowserClientVendors];
export type BrowserShortcutsUri = (typeof BrowserShortcutsUris)[keyof typeof BrowserShortcutsUris];
export type DisablePasswordManagerUri =
  (typeof DisablePasswordManagerUris)[keyof typeof DisablePasswordManagerUris];

export type AutofillFieldQualifierType =
  (typeof AutofillFieldQualifier)[keyof typeof AutofillFieldQualifier];

export type AutofillTargetingRules = {
  [type in AutofillTargetingRuleTypes]?: string;
};

export type AutofillTargetingRuleTypes = keyof typeof AutofillFieldQualifier | "totp";

export type AutofillTargetingRulesByDomain = {
  [key: string]: AutofillTargetingRules;
};
