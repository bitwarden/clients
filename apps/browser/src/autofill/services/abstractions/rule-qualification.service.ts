import { FormContent } from "@bitwarden/common/autofill/types";

import { FillAssistMissReason } from "../../background/fill-assist-event-receiver";
import AutofillPageDetails from "../../models/autofill-page-details";
import { FormFieldElement } from "../../types";

/**
 * Forms that hold at least one of a targeting rule's declared selectors.
 * Half 1 (`checkStructural`) populates `forms`. Half 2 (`checkInScopeExtras`)
 * runs heuristic field detection within those forms and stores the result in
 * `detectedFields` so the miss path can reuse it rather than detecting fields
 * in those forms again.
 */
export type InScopeFormsDetection = {
  forms: Set<HTMLFormElement>;
  detectedFields?: Map<HTMLFormElement, FormFieldElement[]>;
};

export type QualificationResult =
  | { kind: "proceedTargeted" }
  | {
      kind: "fallback";
      missReason: FillAssistMissReason;
      pageDetails: AutofillPageDetails;
    };

/**
 * Decides whether a matched targeting rule can fill the current page. A rule
 * qualifies only when both halves pass:
 *   - Half 1 (structural): every declared selector resolves to an eligible field.
 *   - Half 2 (in-scope extras): no undeclared field exists in any form the rule
 *     declares at least one selector in.
 * Either half failing triggers the miss path: heuristic collection with the
 * full security-check suite re-engaged. The field caches are cleared before
 * heuristic collection runs so the heuristic pass starts fresh.
 */
export interface RuleQualificationService {
  qualifyRule(url: string, matchedRule: FormContent[]): Promise<QualificationResult>;
}
