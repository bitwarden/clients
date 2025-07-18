import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";

@Component({
  selector: "bit-section",
  imports: [CommonModule],
  template: `
    <section
      [ngClass]="{
        'tw-mb-5 bit-compact:tw-mb-4 [&:not(bit-dialog_*):not(popup-page_*)]:md:tw-mb-12':
          !disableMargin(),
      }"
    >
      <ng-content></ng-content>
    </section>
  `,
})
export class SectionComponent {
  readonly disableMargin = input(false, { transform: coerceBooleanProperty });
}
