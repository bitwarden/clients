import { Directive, OnInit, Optional } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

@Directive({
  selector: "[bitPrefix]",
  host: {
    "[class]": "classList",
  },
})
export class BitPrefixDirective implements OnInit {
  readonly classList = [
    "tw-transition-colors tw-text-fg-body-subtle",
    "group-hover/form-field:tw-text-fg-brand",
  ];

  constructor(@Optional() private iconButtonComponent: BitIconButtonComponent) {}

  ngOnInit() {
    if (this.iconButtonComponent) {
      this.iconButtonComponent.size.set("small");
    }
  }
}
