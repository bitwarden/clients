import { Directive, HostBinding, HostListener, input } from "@angular/core";

import { DisclosureComponent } from "./disclosure.component";

@Directive({
  selector: "[bitDisclosureTriggerFor]",
  exportAs: "disclosureTriggerFor",
})
export class DisclosureTriggerForDirective {
  /**
   * Accepts template reference for a bit-disclosure component instance
   */
  readonly disclosure = input.required<DisclosureComponent>({ alias: "bitDisclosureTriggerFor" });

  @HostBinding("attr.aria-expanded") get ariaExpanded() {
    return this.disclosure().open;
  }

  @HostBinding("attr.aria-controls") get ariaControls() {
    return this.disclosure().id;
  }

  @HostListener("click") click() {
    this.disclosure().open = !this.disclosure().open;
  }
}
