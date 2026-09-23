import { booleanAttribute, ChangeDetectionStrategy, Component, input, signal } from "@angular/core";

import { AccordionVariant } from "./accordion.component";

@Component({
  selector: "bit-accordion-group",
  template: "<ng-content />",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccordionGroupComponent {
  readonly singleSelect = input(false, { transform: booleanAttribute });
  readonly variant = input<AccordionVariant>("default");

  readonly activeAccordionId = signal<string | null>(null);

  notifyOpened(id: string) {
    if (this.singleSelect()) {
      this.activeAccordionId.set(id);
    }
  }
}
