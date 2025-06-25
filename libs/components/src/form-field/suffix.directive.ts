import { Directive, OnInit, Optional } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

@Directive({
  selector: "[bitSuffix]",
  host: {
    "[class]": "classList",
  },
})
export class BitSuffixDirective implements OnInit {
  readonly classList = ["tw-text-muted"];

  constructor(@Optional() private iconButtonComponent: BitIconButtonComponent) {}

  ngOnInit() {
    if (this.iconButtonComponent) {
      this.iconButtonComponent.size.set("small");
    }
  }
}
