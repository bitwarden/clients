import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { AutofillTriageFieldResult } from "../../types/autofill-triage";

export interface AutofillTriageService {
  /**
   * Analyzes a single field to determine why it was qualified (or not qualified) for autofill.
   * Returns a detailed result with all qualification checks performed.
   *
   * @param field - The field to analyze
   * @param pageDetails - The page context containing all fields and forms
   * @returns Detailed triage result with eligibility status and conditions checked
   */
  triageField(field: AutofillField, pageDetails: AutofillPageDetails): AutofillTriageFieldResult;
}
