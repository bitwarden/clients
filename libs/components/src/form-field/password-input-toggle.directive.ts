import {
  AfterContentInit,
  Directive,
  EventEmitter,
  Host,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  Output,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { BitFormFieldComponent } from "./form-field.component";

@Directive({
  selector: "[bitPasswordInputToggle]",
  standalone: true,
})
export class BitPasswordInputToggleDirective implements AfterContentInit, OnChanges {
  /**
   * Whether the input is toggled to show the password.
   */
  @HostBinding("attr.aria-pressed") @Input() toggled = false;
  @Output() toggledChange = new EventEmitter<boolean>();

  @HostBinding("attr.title") title = this.i18nService.t("toggleVisibility");
  @HostBinding("attr.aria-label") label = this.i18nService.t("toggleVisibility");

  /**
   * Click handler to toggle the state of the input type.
   */
  @HostListener("click") onClick() {
    this.toggled = !this.toggled;
    this.toggledChange.emit(this.toggled);

    this.update();
  }

  constructor(
    @Host() private button: BitIconButtonComponent,
    private formField: BitFormFieldComponent,
    private i18nService: I18nService,
  ) {}

  get icon() {
    return this.toggled ? "bwi-eye-slash" : "bwi-eye";
  }

  ngOnChanges(): void {
    this.update();
  }

  ngAfterContentInit(): void {
    if (this.formField.input?.type) {
      this.toggled = this.formField.input.type !== "password";
    }
    this.button.icon = this.icon;
  }

  private update() {
    this.button.icon = this.icon;
    if (this.formField.input?.type != null) {
      this.formField.input.type = this.toggled ? "text" : "password";
      this.formField.input.spellcheck = this.toggled ? false : undefined;
    }
  }
}
