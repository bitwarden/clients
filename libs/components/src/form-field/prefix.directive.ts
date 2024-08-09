import { AfterContentInit, Directive, HostBinding, Input, OnInit, Optional } from "@angular/core";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { BitFormFieldComponent } from "./form-field.component";

@Directive({
  selector: "[bitPrefix]",
})
export class BitPrefixDirective implements OnInit, AfterContentInit {
  @HostBinding("class") @Input() get classList() {
    return ["tw-text-muted"];
  }

  @HostBinding("attr.aria-describedby")
  protected ariaDescribedBy: string;

  constructor(
    @Optional() private parentFormField: BitFormFieldComponent,
    @Optional() private iconButtonComponent: BitIconButtonComponent,
  ) {}

  ngOnInit() {
    if (this.iconButtonComponent) {
      this.iconButtonComponent.size = "small";
    }
  }

  ngAfterContentInit() {
    if (this.parentFormField?.label?.id) {
      this.ariaDescribedBy = this.parentFormField.label.id;
    }
  }
}
