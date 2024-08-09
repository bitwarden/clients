import { Directive, HostBinding } from "@angular/core";

// Increments for each instance of this component
let nextId = 0;

@Directive({
  selector: "bit-hint",
  host: {
    class: "tw-text-muted tw-font-normal tw-inline-block tw-mt-1 tw-text-xs",
  },
})
export class BitHintComponent {
  @HostBinding() id = `bit-hint-${nextId++}`;
}
