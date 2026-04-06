import AutofillField from "./autofill-field";
import AutofillForm from "./autofill-form";

/**
 * The details of a page that have been collected and can be used for autofill
 */
export default class AutofillPageDetails {
  /** Non-null asserted. */
  title!: string;
  /** Non-null asserted. */
  url!: string;
  /** Non-null asserted. */
  documentUrl!: string;
  /**
   * Non-null asserted. A collection of all of the forms in the page DOM, keyed by their `opid`
   */
  forms!: { [id: string]: AutofillForm };
  /**
   * Non-null asserted. A collection of all the fields in the page DOM, keyed by their `opid`
   */
  fields!: AutofillField[];
  /** Non-null asserted. */
  collectedTimestamp!: number;
}
