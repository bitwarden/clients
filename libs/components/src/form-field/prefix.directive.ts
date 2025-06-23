import { Directive, HostBinding, Input, OnInit, Optional } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

@Directive({
  selector: "[bitPrefix]",
})
export class BitPrefixDirective implements OnInit {
  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @HostBinding("class") @Input() get classList() {
    return ["tw-text-muted"];
  }

  constructor(@Optional() private iconButtonComponent: BitIconButtonComponent) {}

  ngOnInit() {
    if (this.iconButtonComponent) {
      this.iconButtonComponent.size = "small";
    }
  }
}
