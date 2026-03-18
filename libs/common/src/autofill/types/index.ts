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
 * Supports shadow DOM piercing via the `>>>` combinator syntax.
 */
export type AutofillTargetingRules = {
  [type in AutofillTargetingRuleType]?: string;
};

/**
 * Maps a normalized URL (hostname + path, protocol is assumed) to the targeting rules
 * for that page. The URL key is normalized by stripping query strings and fragments.
 */
export type AutofillTargetingRulesByDomain = {
  // @TODO Note, this does not represent a finalized data shape
  [normalizedUrl: string]: AutofillTargetingRules;
};

/**
 * Descriptors of web domains, their pages, and page content.
 * Rules do not prescribe or imply behaviour of consuming contexts.
 */
export type TargetingRulesByDomain = {
  /**
   * The presence of a key with a `null` value indicates all
   * pages should be ignored (e.g. Autofill should not be used)
   * across the site
   */
  [hostname: string]: TargetingRules | null; // @TODO improve `hostname` typing
};

type TargetingRules = {
  /**
   * Multiple form definitions for a given page allows for mixed for types
   * (e.g. a billing / shipping combo), unpredictable renders (e.g. multivariate
   * testing), multi-step flows at a single URI (e.g. SPAs), etc
   */
  forms: FormContent[];
  pathnames: {
    /**
     * The presence of a key with a `null` value indicates the page
     * should be ignored (e.g. Autofill should not be used)
     */
    [pathname: string]: {
      forms: FormContent[];
    } | null; // @TODO improve `pathname` typing
  };
};

type FormPurposeCategory =
  | "account-creation"
  | "account-login"
  | "account-recovery"
  | "address"
  | "email-update"
  | "identity"
  | "password-update"
  | "payment-card"
  | "search"
  | "shipping"
  | "subscribe";

/**
 * "form" here represents the user-facing concept and does not
 * require a literal HTML `form` tag or structure
 */
type FormContent = {
  /**
   * An optional descriptor of the form, useful for mapping separate concerns
   * (e.g. a page with both a login and registration form, mixed-purpose form, etc)
   *
   * Note, the client logic can use these to make determinations about what _not_ to
   * consider as well (e.g. don't autofill search forms, newsletter sign ups)
   */
  category?: FormPurposeCategory;
  selectors: {
    [type in AutofillTargetingRuleType | "form"]?: DeepSelector[];
  };
};

/**
 * a CSS selector which can optionally include the `>>>` combinator to
 * represent a Shadow boundary between a Shadow host and a Shadow root
 */
type DeepSelector = string; // @TODO improve typing

export type ClearClipboardDelaySetting =
  (typeof ClearClipboardDelay)[keyof typeof ClearClipboardDelay];

export type InlineMenuVisibilitySetting =
  (typeof AutofillOverlayVisibility)[keyof typeof AutofillOverlayVisibility];

export type BrowserClientVendor = (typeof BrowserClientVendors)[keyof typeof BrowserClientVendors];
export type BrowserShortcutsUri = (typeof BrowserShortcutsUris)[keyof typeof BrowserShortcutsUris];
export type DisablePasswordManagerUri =
  (typeof DisablePasswordManagerUris)[keyof typeof DisablePasswordManagerUris];
