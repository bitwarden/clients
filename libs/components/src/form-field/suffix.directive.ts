import { Directive, OnInit, Optional } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

@Directive({
  selector: "[bitSuffix]",
  host: {
    "[class]": "classList",
  },
})
export class BitSuffixDirective implements OnInit {
  readonly classList: string[];

  constructor(@Optional() private iconButtonComponent: BitIconButtonComponent) {
    this.classList = this.iconButtonComponent ? [] : ["tw-text-muted"];
  }

  ngOnInit() {
    if (this.iconButtonComponent) {
      this.iconButtonComponent.size.set("small");
    }
  }
}
