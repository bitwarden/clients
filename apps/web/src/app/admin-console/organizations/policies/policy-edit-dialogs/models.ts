import { Signal, TemplateRef } from "@angular/core";
import { Observable } from "rxjs";

export type PolicyStep = {
  // Side effect to execute when submitting this step
  sideEffect?: () => Promise<void>;

  // Optional: Custom title template. If undefined, uses default: "Edit policy" with policy name subtitle
  titleContent?: Signal<TemplateRef<unknown> | undefined>;

  // Optional: Custom body template. If undefined, renders the policy component's template
  bodyContent?: Signal<TemplateRef<unknown> | undefined>;

  // Optional: Custom footer template. If undefined, uses default: "Save" (primary) + "Cancel" (secondary)
  footerContent?: Signal<TemplateRef<unknown> | undefined>;

  // Optional: Observable to disable save button. If undefined, defaults to form validation state
  disableSave?: Observable<boolean>;
};
