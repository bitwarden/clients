import { Component } from "@angular/core";

import { TypographyModule } from "../typography";

@Component({
  standalone: true,
  selector: "bit-section-header",
  templateUrl: "./section-header.component.html",
  imports: [TypographyModule],
  host: {
    class:
      // apply bottom and x padding when a `bit-card` or `bit-item` is the immediate sibling, or nested in the immediate sibling
      "tw-block has-[+_*_bit-card]:tw-pb-1 has-[+_bit-card]:tw-pb-1 has-[+_*_bit-item]:tw-pb-1 has-[+_bit-item]:tw-pb-1 has-[+_*_bit-card]:tw-px-1 has-[+_bit-card]:tw-px-1 has-[+_*_bit-item]:tw-px-1 has-[+_bit-item]:tw-px-1",
  },
})
export class SectionHeaderComponent {}
