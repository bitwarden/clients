import AutofillPageDetails from "../models/autofill-page-details";

export const TriageQualification = Object.freeze({
  Login: "login",
  CreditCard: "creditCard",
  AccountCreation: "accountCreation",
  Identity: "identity",
  Ineligible: "ineligible",
} as const);
export type TriageQualification = (typeof TriageQualification)[keyof typeof TriageQualification];

/**
 * Response returned by the content script after collecting page details for triage.
 */
export interface AutofillTriageResponse {
  pageDetails: AutofillPageDetails;
  /**
   * The htmlID or htmlName of the right-clicked field, if resolvable.
   */
  targetFieldRef?: string;
}

/**
 * Represents the result of a single condition check during field triage.
 */
export interface AutofillTriageConditionResult {
  /**
   * Human-readable description of what this condition checks.
   */
  description: string;

  /**
   * Whether this condition passed (true) or failed (false).
   */
  passed: boolean;
}

/**
 * Context information about the page being analyzed.
 */
export interface AutofillTriagePageContext {
  /**
   * The title of the page.
   */
  title: string;

  /**
   * The document URL (may differ from page URL in iframes).
   */
  documentUrl: string;

  /**
   * Total number of forms detected on the page.
   */
  totalForms: number;

  /**
   * Total number of fields detected on the page.
   */
  totalFields: number;

  /**
   * Unix timestamp of when page details were collected.
   */
  collectedTimestamp: number;
}

/**
 * Browser information for version tracking.
 */
export interface AutofillTriageBrowserInfo {
  /**
   * Browser name (e.g., "Chrome", "Firefox", "Edge").
   */
  name: string;

  /**
   * Browser version string.
   */
  version: string;
}

/**
 * Triage results for all fields on a page, assembled by the background after collecting page details.
 */
export interface AutofillTriagePageResult {
  /**
   * The browser tab ID this result was collected from.
   */
  tabId: number;

  /**
   * The URL of the page that was analyzed.
   */
  pageUrl: string;

  /**
   * When the triage was performed.
   */
  analyzedAt: Date;

  /**
   * The htmlID or htmlName of the field that was right-clicked, if scope is a single field.
   */
  targetElementRef?: string;

  /**
   * Triage results for each analyzed field.
   */
  fields: AutofillTriageFieldResult[];

  /**
   * Additional context about the page.
   */
  pageContext?: AutofillTriagePageContext;

  /**
   * Extension version that generated this report.
   */
  extensionVersion: string;

  /**
   * Browser name and version.
   */
  browserInfo: AutofillTriageBrowserInfo;
}

/**
 * Information about the form that contains this field.
 */
export interface AutofillTriageFormContext {
  /**
   * The form's HTML ID attribute, if present.
   */
  htmlId?: string;

  /**
   * The form's HTML name attribute, if present.
   */
  htmlName?: string;

  /**
   * The form's action URL, if present.
   */
  htmlAction?: string;

  /**
   * The form's HTTP method (GET, POST, etc.), if present.
   */
  htmlMethod?: string;

  /**
   * Number of fields in this form.
   */
  fieldCount: number;
}

/**
 * Complete triage analysis result for a single field.
 */
export interface AutofillTriageFieldResult {
  /**
   * The HTML ID attribute of the field, if present.
   */
  htmlId?: string;

  /**
   * The HTML name attribute of the field, if present.
   */
  htmlName?: string;

  /**
   * The HTML type attribute (e.g., "text", "password", "email").
   */
  htmlType?: string;

  /**
   * The placeholder text of the field, if present.
   */
  placeholder?: string;

  /**
   * The ARIA label of the field, if present.
   */
  ariaLabel?: string;

  /**
   * The autocomplete attribute value, if present.
   */
  autocomplete?: string;

  /**
   * The ID/index of the form this field belongs to, if applicable.
   */
  formIndex?: string;

  /**
   * Whether this field is eligible for autofill based on all checks performed.
   */
  eligible: boolean;

  /**
   * What category this field qualified as.
   */
  qualifiedAs: TriageQualification;

  /**
   * Array of all qualification conditions that were checked, with their results.
   */
  conditions: AutofillTriageConditionResult[];

  /**
   * Whether the field is viewable/visible in the viewport.
   */
  viewable?: boolean;

  /**
   * Whether the field is readonly.
   */
  readonly?: boolean;

  /**
   * Whether the field is disabled.
   */
  disabled?: boolean;

  /**
   * The HTML tag name of the field (e.g., "input", "select", "textarea").
   */
  tagName?: string;

  /**
   * Sequential number assigned to the element based on its DOM position.
   */
  elementNumber?: number;

  /**
   * Text content to the left of the field in the DOM.
   */
  labelLeft?: string;

  /**
   * Text content to the right of the field in the DOM.
   */
  labelRight?: string;

  /**
   * Text content from associated label tags.
   */
  labelTag?: string;

  /**
   * Text content from table row above (for data tables).
   */
  labelTop?: string;

  /**
   * The HTML class attribute of the field.
   */
  htmlClass?: string;

  /**
   * The title attribute of the field.
   */
  title?: string;

  /**
   * The tabindex attribute of the field.
   */
  tabindex?: string;

  /**
   * The maxLength attribute of the field.
   */
  maxLength?: number;

  /**
   * Whether the field has ARIA-hidden attribute.
   */
  ariaHidden?: boolean;

  /**
   * Whether the field has ARIA-disabled attribute.
   */
  ariaDisabled?: boolean;

  /**
   * The data-stripe attribute value, if present.
   */
  dataStripe?: string;

  /**
   * Inline menu fill type classification.
   */
  inlineMenuFillType?: string;

  /**
   * Field qualifier type.
   */
  fieldQualifier?: string;

  /**
   * Account creation field type classification.
   */
  accountCreationFieldType?: string;

  /**
   * Form context, if this field belongs to a form.
   */
  formContext?: AutofillTriageFormContext;

  /**
   * Preview of the field's current value (sanitized for security).
   */
  valuePreview?: string;

  /**
   * For checkbox/radio inputs, whether the field is checked.
   */
  checked?: boolean;

  /**
   * For select elements, information about available options.
   */
  selectOptions?: string[];

  /**
   * The rel attribute value, if present.
   */
  rel?: string;

  /**
   * Whether passkeys should be shown for this field.
   */
  showPasskeys?: boolean;

  /**
   * Whether the field has ARIA has-popup attribute.
   */
  ariaHasPopup?: boolean;
}
