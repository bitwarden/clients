// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

@Component({
  selector: "review-logo",
  templateUrl: "review-logo.component.html",
})
export class ReviewLogoComponent {
  @Input() logoClass: string;
  @Input() logoSrc: string;
  @Input() logoAlt: string;
}
