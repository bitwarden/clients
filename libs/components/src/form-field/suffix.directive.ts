import { Directive, inject, OnInit } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

@Directive({
  selector: "[bitSuffix]",
  host: {
    "[class]": "classList",
  },
})
export class BitSuffixDirective implements OnInit {
  private iconButtonComponent = inject(BitIconButtonComponent, { optional: true });

  readonly classList = this.iconButtonComponent ? [] : ["tw-text-muted"];

  ngOnInit() {
    if (this.iconButtonComponent) {
      this.iconButtonComponent.size.set("small");
    }
  }
}
