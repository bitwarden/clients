import { Directive, input, OnInit, Optional } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

@Directive({
  selector: "[bitPrefix]",
  host: {
    "[attr.class]": "classList()",
  },
})
export class BitPrefixDirective implements OnInit {
  readonly classList = input(["tw-text-muted"]);

  constructor(@Optional() private iconButtonComponent: BitIconButtonComponent) {}

  ngOnInit() {
    if (this.iconButtonComponent) {
      this.iconButtonComponent.size = "small";
    }
  }
}
