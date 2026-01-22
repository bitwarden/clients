import { Directive, HostBinding } from "@angular/core";

// Increments for each instance of this component
let nextId = 0;

/**
 * Directive for displaying hint text below form inputs.
 */
@Directive({
  selector: "bit-hint",
  host: {
    class: "tw-text-muted tw-font-normal tw-inline-block tw-mt-1 tw-text-xs",
  },
})
export class BitHintDirective {
  @HostBinding() id = `bit-hint-${nextId++}`;
}
