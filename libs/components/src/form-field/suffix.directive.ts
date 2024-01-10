import { Directive, HostBinding, Input, OnInit, Optional } from "@angular/core";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

import { PrefixButtonClasses, PrefixClasses, PrefixStaticContentClasses } from "./prefix.directive";

@Directive({
  selector: "[bitSuffix]",
})
export class BitSuffixDirective implements OnInit {
  constructor(@Optional() private buttonComponent: ButtonLikeAbstraction) {}

  @HostBinding("class") @Input() get classList() {
    return PrefixClasses.concat([
      "tw-border-l-0",
      "last:tw-rounded-r",

      "focus-visible:tw-border-l",
      "focus-visible:tw-ml-[-1px]",
    ]).concat(this.buttonComponent != undefined ? PrefixButtonClasses : PrefixStaticContentClasses);
  }

  ngOnInit(): void {
    this.buttonComponent?.setButtonType("unstyled");
  }
}
