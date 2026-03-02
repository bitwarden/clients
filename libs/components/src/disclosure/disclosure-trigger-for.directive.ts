import { Directive, computed, input } from "@angular/core";

import { DisclosureComponent } from "./disclosure.component";

/**
 * Directive that connects a trigger element (like a button) to a disclosure component.
 * Automatically handles click events to toggle the disclosure open/closed state and
 * manages ARIA attributes for accessibility.
 */
@Directive({
  selector: "[bitDisclosureTriggerFor]",
  exportAs: "disclosureTriggerFor",
  host: {
    "[attr.aria-expanded]": "ariaExpanded()",
    "[attr.aria-controls]": "ariaControls()",
    "(click)": "toggle()",
  },
})
export class DisclosureTriggerForDirective {
  /**
   * Accepts template reference for a bit-disclosure component instance
   */
  readonly disclosure = input.required<DisclosureComponent>({ alias: "bitDisclosureTriggerFor" });

  protected readonly ariaExpanded = computed(() => this.disclosure().open());

  protected readonly ariaControls = computed(() => this.disclosure().id);

  protected toggle() {
    this.disclosure().open.update((open) => !open);
  }
}
