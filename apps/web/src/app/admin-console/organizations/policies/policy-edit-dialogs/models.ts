import { Signal, TemplateRef } from "@angular/core";

export type MultiStepSubmit = {
  sideEffect?: () => Promise<void>;
  footerContent: Signal<TemplateRef<unknown> | undefined>;
  titleContent: Signal<TemplateRef<unknown> | undefined>;
};
