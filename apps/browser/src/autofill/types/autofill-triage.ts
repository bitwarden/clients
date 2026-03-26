import AutofillPageDetails from "../models/autofill-page-details";

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
   * ISO timestamp of when the triage was performed.
   */
  analyzedAt: string;

  /**
   * The htmlID or htmlName of the field that was right-clicked, if scope is a single field.
   */
  targetElementRef?: string;

  /**
   * Triage results for each analyzed field.
   */
  fields: AutofillTriageFieldResult[];
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
   * What category this field qualified as (e.g., "login", "creditCard", "identity", "accountCreation", "ineligible").
   */
  qualifiedAs: string;

  /**
   * Array of all qualification conditions that were checked, with their results.
   */
  conditions: AutofillTriageConditionResult[];
}
