import {
  AfterContentInit,
  Directive,
  EventEmitter,
  Host,
  HostBinding,
  HostListener,
  model,
  OnChanges,
  Output,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { BitFormFieldComponent } from "./form-field.component";

@Directive({
  selector: "[bitPasswordInputToggle]",
  host: {
    "[attr.aria-pressed]": "toggled()",
  },
})
export class BitPasswordInputToggleDirective implements AfterContentInit, OnChanges {
  /**
   * Whether the input is toggled to show the password.
   */
  readonly toggled = model(false);
  @Output() toggledChange = new EventEmitter<boolean>();

  @HostBinding("attr.title") title = this.i18nService.t("toggleVisibility");
  @HostBinding("attr.aria-label") label = this.i18nService.t("toggleVisibility");

  /**
   * Click handler to toggle the state of the input type.
   */
  @HostListener("click") onClick() {
    this.toggled.update((toggled) => !toggled);
    this.toggledChange.emit(this.toggled());

    this.update();
  }

  constructor(
    @Host() private button: BitIconButtonComponent,
    private formField: BitFormFieldComponent,
    private i18nService: I18nService,
  ) {}

  get icon() {
    return this.toggled() ? "bwi-eye-slash" : "bwi-eye";
  }

  ngOnChanges(): void {
    this.update();
  }

  ngAfterContentInit(): void {
    const input = this.formField.input();
    if (input?.type) {
      this.toggled.set(input.type() !== "password");
    }
    this.button.icon.set(this.icon);
  }

  private update() {
    this.button.icon.set(this.icon);
    const input = this.formField.input();
    if (input?.type != null) {
      input.type.set(this.toggled() ? "text" : "password");
      input?.spellcheck?.set(this.toggled() ? false : undefined);
    }
  }
}
