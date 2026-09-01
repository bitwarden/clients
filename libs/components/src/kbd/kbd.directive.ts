import { Directive } from "@angular/core";

@Directive({
  selector: "kbd[bitKbd]",
  host: {
    class:
      "tw-inline-flex tw-items-center tw-rounded tw-border tw-border-solid tw-border-border-base tw-bg-bg-primary tw-p-1 tw-font-mono tw-text-xs/4 tw-text-fg-body-subtle",
  },
})
export class KbdDirective {}
