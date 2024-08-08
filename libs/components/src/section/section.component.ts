import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

@Component({
  selector: "bit-section",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      [ngClass]="{
        'tw-mb-6 md:tw-mb-12': !disableMargin
      }"
    >
      <ng-content></ng-content>
    </section>
  `,
})
export class SectionComponent {
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;
}
