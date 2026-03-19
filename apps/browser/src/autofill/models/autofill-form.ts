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
}
