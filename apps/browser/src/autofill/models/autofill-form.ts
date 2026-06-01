/**
 * Represents an HTML form whose elements can be autofilled
 */
export default class AutofillForm {
  [key: string]: any;

  /**
   * Non-null asserted. The unique identifier assigned to this field during collection of the page details
   */
  opid!: string;

  /**
   * Non-null asserted. The HTML `name` attribute of the form field
   */
  htmlName!: string;

  /**
   * Non-null asserted. The HTML `id` attribute of the form field
   */
  htmlID!: string;

  /**
   * Non-null asserted. The HTML `action` attribute of the form field
   */
  htmlAction!: string;

  /**
   * Non-null asserted. The HTML `method` attribute of the form field.
   */
  htmlMethod!: "get" | "post" | string;

  /**
   * The HTML `class` attribute of the form. Empty string when the attribute is absent.
   */
  htmlClass!: string;

  /**
   * Heading text from the form's bounded ancestors, ordered by ancestor distance
   * (closest first).
   */
  htmlAncestorHeadings!: string[];

  /**
   * Opid assigned to the form's submit button when a targeting rule's
   * `actions.submit` selector resolved during collection. Absent when no rule
   * applied, when the rule did not provide an `actions.submit` selector, or
   * when none of the provided selectors matched. The targeted-submit-button
   * registry on the overlay service distinguishes the unresolved case (which
   * suppresses heuristic submit-button discovery) from the no-rule case.
   */
  submitButtonOpid?: string;
}
