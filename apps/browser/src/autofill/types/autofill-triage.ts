/**
 * Represents a single condition check performed during autofill triage.
 */
export type AutofillTriageCondition = {
  /** Human-readable description of what this condition checks */
  description: string;
  /** Whether this condition passed (true) or failed (false) */
  passed: boolean;
};

/**
 * Represents the triage result for a single form field.
 */
export type AutofillTriageFieldResult = {
  /** Whether this field is eligible for autofill */
  eligible: boolean;
  /** The field qualification type (e.g., "username", "password", "email") */
  qualifiedAs: string;
  /** List of condition checks performed on this field */
  conditions: AutofillTriageCondition[];
  /** HTML id attribute of the field (if present) */
  htmlId?: string;
  /** HTML name attribute of the field (if present) */
  htmlName?: string;
  /** HTML type attribute of the field (if present) */
  htmlType?: string;
  /** Placeholder text of the field (if present) */
  placeholder?: string;
  /** Autocomplete attribute value (if present) */
  autocomplete?: string;
  /** ARIA label of the field (if present) */
  ariaLabel?: string;
  /** Index of the form this field belongs to (if applicable) */
  formIndex?: number;
};

/**
 * Represents the complete triage result for a page.
 */
export type AutofillTriagePageResult = {
  /** URL of the page that was analyzed */
  pageUrl: string;
  /** ISO 8601 timestamp of when the analysis was performed */
  analyzedAt: string;
  /** List of field results from the triage analysis */
  fields: AutofillTriageFieldResult[];
  /** Reference to the target element that triggered the triage (if applicable) */
  targetElementRef?: string;
};
