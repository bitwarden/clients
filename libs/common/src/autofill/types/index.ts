import {
  AutofillOverlayVisibility,
  AutofillTargetingRuleTypes,
  BrowserClientVendors,
  BrowserShortcutsUris,
  ClearClipboardDelay,
  DisablePasswordManagerUris,
  FormPurposeCategories,
} from "../constants";

/**
 * Format of the Forms Map resource.
 */
export type FormsMapResource = {
  schemaVersion: string;
  hosts: TargetingRulesByDomain;
};

/**
 * Descriptors of web domains, their pages, and page content.
 * Rules do not prescribe or imply behaviour of consuming contexts.
 */
export type TargetingRulesByDomain = {
  /**
   * Keys are `host` values (hostname, or hostname:port when a non-default
   * port is used). `example.com` and `example.com:8443` are distinct entries
   * with no fallback between them. Default ports (e.g. `:443` for HTTPS)
   * are omitted per `URL.host` normalization.
   *
   * The presence of a key with a `null`, `undefined`, or empty value
   * indicates all pages belonging to the host should be ignored
   * (e.g. Autofill should not be used).
   */
  [host: string]: TargetingRules | null;
};

type TargetingRules = {
  /**
   * Multiple form definitions for a given page allows for mixed form types
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
    [pathname: Pathname]: {
      /**
       * Multiple form definitions for a given page allows for mixed form types
       * (e.g. a billing / shipping combo), unpredictable renders (e.g. multivariate
       * testing), multi-step flows at a single URI (e.g. SPAs), etc
       */
      forms: FormContent[];
    } | null;
  };
};

export type FormPurposeCategory =
  (typeof FormPurposeCategories)[keyof typeof FormPurposeCategories];

export type AutofillTargetingRuleType =
  (typeof AutofillTargetingRuleTypes)[keyof typeof AutofillTargetingRuleTypes];

/**
 * Maps a field key to its CSS selector alternatives. Each entry identifies a
 * specific form field on a page. Supports shadow DOM and iframe piercing via
 * the `>>>` combinator syntax.
 *
 * Each value is a composite selector array: items are either a single
 * DeepSelector (string) targeting one element, or a DeepSelectorSequence
 * (string[]) targeting multiple elements that together compose one value
 * (e.g. a 6-digit OTP split across 6 inputs).
 */
type FormFields = {
  [type in AutofillTargetingRuleType]?: (DeepSelector | DeepSelectorSequence)[];
};

type FormActionKey = "submit" | "save" | "next" | "previous" | "cancel" | "reset";

/**
 * Maps action keys to selector arrays for structural interactions
 */
type FormActions = {
  [key in FormActionKey]?: DeepSelector[];
};

/**
 * A `FormContent` "Form" is a representation of the user-facing concept
 * and does not require a literal HTML `form` tag or structure
 */
export type FormContent = {
  /**
   * Descriptor of the form's purpose, useful for mapping separate concerns
   * (e.g. a page with both a login and registration form, mixed-purpose form, etc)
   *
   * Note: the client logic can use these to make determinations about what _not_ to
   * consider as well (e.g. don't autofill search forms, newsletter sign ups)
   */
  category: FormPurposeCategory;
  /** Optional selector array identifying the form's container element on the page */
  container?: DeepSelector[];
  fields: FormFields;
  actions?: FormActions;
};

/** A URL pathname; must start with `/` */
export type Pathname = `/${string}`;

/**
 * A CSS selector which can optionally include the `>>>` combinator to
 * represent a boundary that standard CSS selectors cannot cross.
 * The boundary type is determined by the preceding selector segment:
 * - Shadow DOM boundary (default): `#host >>> input`
 * - Iframe boundary: `iframe#login >>> input`
 */
type DeepSelector = string;

/**
 * An ordered sequence of CSS selectors representing multiple elements that
 * together compose a single value for a field (e.g. a 6-digit OTP split
 * across 6 inputs). Order is significant.
 */
type DeepSelectorSequence = DeepSelector[];

export type ClearClipboardDelaySetting =
  (typeof ClearClipboardDelay)[keyof typeof ClearClipboardDelay];

export type InlineMenuVisibilitySetting =
  (typeof AutofillOverlayVisibility)[keyof typeof AutofillOverlayVisibility];

export type BrowserClientVendor = (typeof BrowserClientVendors)[keyof typeof BrowserClientVendors];
export type BrowserShortcutsUri = (typeof BrowserShortcutsUris)[keyof typeof BrowserShortcutsUris];
export type DisablePasswordManagerUri =
  (typeof DisablePasswordManagerUris)[keyof typeof DisablePasswordManagerUris];
