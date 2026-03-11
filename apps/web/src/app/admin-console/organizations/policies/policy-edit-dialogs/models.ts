import { Signal, TemplateRef } from "@angular/core";
import { Observable } from "rxjs";

export type PolicyStepResult = { closeDialog?: boolean } | undefined;

export type PolicyStep = {
  // Side effect to execute when submitting this step.
  // Return { closeDialog: true } to show the success toast and close the dialog immediately,
  // bypassing any remaining steps. Useful when a step conditionally ends the workflow early
  // (e.g. when disabling a policy or when the user lacks permission to see subsequent steps).
  sideEffect?: () => Promise<PolicyStepResult | void>;

  // Optional: Custom title template. If undefined, uses default: "Edit policy" with policy name subtitle
  titleContent?: Signal<TemplateRef<unknown> | undefined>;

  // Optional: Custom body template. If undefined, renders the policy component's template
  bodyContent?: Signal<TemplateRef<unknown> | undefined>;

  // Optional: Custom footer template. If undefined, uses default: "Save" (primary) + "Cancel" (secondary)
  footerContent?: Signal<TemplateRef<unknown> | undefined>;

  // Optional: Observable to disable save button. If undefined, defaults to form validation state
  disableSave?: Observable<boolean>;
};
