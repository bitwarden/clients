import { Directive, HostBinding, Input, OnInit, Optional } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

@Directive({
  selector: "[bitSuffix]",
  standalone: true,
})
export class BitSuffixDirective implements OnInit {
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
