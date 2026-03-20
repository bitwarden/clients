import {
  AutofillOverlayVisibility,
  AutofillTargetingRuleTypes,
  BrowserClientVendors,
  BrowserShortcutsUris,
  ClearClipboardDelay,
  DisablePasswordManagerUris,
} from "../constants";

/**
 * Descriptors of web domains, their pages, and page content.
 * Rules do not prescribe or imply behaviour of consuming contexts.
 */
export type TargetingRulesByDomain = {
  /**
   * The presence of a key with a `null`, `undefined`, or empty value
   * indicates all pages belonging to the hostname should be ignored
   * (e.g. Autofill should not be used).
   */
  [hostname: string]: TargetingRules | null; // @TODO improve `hostname` typing
};

type TargetingRules = {
  /**
   * Multiple form definitions for a given page allows for mixed for types
   * (e.g. a billing / shipping combo), unpredictable renders (e.g. multivariate
   * testing), multi-step flows at a single URI (e.g. SPAs), etc
   */
  forms?: FormContent[];
  /**
   * The presence of a key with a `null`, `undefined`, or empty value
   * is not meaningful and should be ignored.
   */
  pathnames?: {
    /**
     * The presence of a key with a `null`, `undefined`, or empty value
     * indicates the page should be ignored (e.g. Autofill should not be used).
     */
    [pathname: string]: {
      /**
       * Multiple form definitions for a given page allows for mixed for types
       * (e.g. a billing / shipping combo), unpredictable renders (e.g. multivariate
       * testing), multi-step flows at a single URI (e.g. SPAs), etc
       */
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

export type AutofillTargetingRuleType =
  (typeof AutofillTargetingRuleTypes)[keyof typeof AutofillTargetingRuleTypes];

/**
 * Maps a selector target type to its CSS query selector string.
 * Each entry identifies a specific form concern on a page using a CSS selector.
 * Supports shadow DOM piercing via the `>>>` combinator syntax.
 */
type FormTargetingRules = {
  [type in AutofillTargetingRuleType | "form"]?: DeepSelector[];
};

/**
 * A `FormContent` "Form" is a representation of the user-facing concept
 * and does not require a literal HTML `form` tag or structure
 */
export type FormContent = {
  /**
   * An optional descriptor of the form, useful for mapping separate concerns
   * (e.g. a page with both a login and registration form, mixed-purpose form, etc)
   *
   * Note, the client logic can use these to make determinations about what _not_ to
   * consider as well (e.g. don't autofill search forms, newsletter sign ups)
   */
  category?: FormPurposeCategory;
  selectors: FormTargetingRules;
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
