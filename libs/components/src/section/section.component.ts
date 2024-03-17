import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  selector: "bit-section",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="tw-mb-12">
      <ng-content></ng-content>
    </section>
  `,
})
export class SectionComponent {}
