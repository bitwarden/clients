import { Directive } from "@angular/core";

@Directive({
  host: {
    class:
      "tw-box-border tw-block tw-bg-background tw-text-main tw-border tw-border-solid tw-border-secondary-100 tw-shadow tw-rounded-xl",
  },
})
export class BaseCardDirective {}
