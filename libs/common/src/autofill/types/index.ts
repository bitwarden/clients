import {
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
