import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from "@angular/core";

import { FormControlComponent } from "./form-control.component";

// Increments for each instance of this component
let nextId = 0;

@Component({
  selector: "bit-label",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "label.component.html",
  imports: [NgTemplateOutlet],
  host: {
    class: "tw-inline-flex tw-gap-1 tw-items-baseline tw-flex-row tw-min-w-0",
    "[id]": "id()",
    "[title]": "title",
  },
})
export class BitLabelComponent {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly isInsideFormControl = !!inject(FormControlComponent, { optional: true });

  // A getter, not a computed: it reads live projected textContent, which has no signal to track.
  get title() {
    return this.elementRef.nativeElement.textContent?.trim() ?? "";
  }

  readonly id = input(`bit-label-${nextId++}`);
}
