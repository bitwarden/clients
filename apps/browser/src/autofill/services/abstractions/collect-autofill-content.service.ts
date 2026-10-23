import { AutofillMonitor } from "../../content/abstractions/autofill-monitor";
import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { ElementWithOpId, FormFieldElement } from "../../types";

import { InScopeFormsDetection, RuleQualificationService } from "./rule-qualification.service";

type AutofillFormElements = Map<ElementWithOpId<HTMLFormElement>, AutofillForm>;

type AutofillFieldElements = Map<ElementWithOpId<FormFieldElement>, AutofillField>;

type UpdateAutofillDataAttributeParams = {
  element: ElementWithOpId<HTMLFormElement | FormFieldElement>;
  attributeName: string;
  dataTarget?: AutofillForm | AutofillField;
  dataTargetKey?: string;
};

interface CollectAutofillContentService extends AutofillMonitor {
  autofillFormElements: AutofillFormElements;
  getPageDetails(): Promise<AutofillPageDetails>;
  prepareForExplicitCollection(): void;
  getAutofillFieldElementByOpid(opid: string): HTMLElement | null;
  applyExternalTargetedFields(
    targetedFields: { selector: string; fieldType: string }[],
  ): Promise<void>;
  clearCachedTargetingRules(): void;
  /**
   * Runs the heuristic collection path after clearing the field caches so the
   * pass starts fresh. Called by `RuleQualificationService` on the miss path.
   * When `cachedInScopeForms.detectedFields` is populated, the bypass reuses
   * those detections rather than scanning the same forms again.
   */
  collectHeuristicPageDetailsBypass(
    cachedInScopeForms?: InScopeFormsDetection,
  ): Promise<AutofillPageDetails>;
  /**
   * Setter wiring to break the circular dependency between this service and
   * the rule qualification service. Called once at DI setup.
   */
  setRuleQualificationService(ruleQualificationService: RuleQualificationService): void;
}

export {
  AutofillFormElements,
  AutofillFieldElements,
  UpdateAutofillDataAttributeParams,
  CollectAutofillContentService,
};
