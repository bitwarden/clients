import { AfterContentInit, Directive, inject, model, OnChanges } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { BitFormFieldComponent } from "./form-field.component";

@Directive({
  selector: "[bitPasswordInputToggle]",
  host: {
    "[attr.aria-pressed]": "toggled()",
    "[attr.title]": "label",
    "[attr.aria-label]": "label",
    "(click)": "onClick()",
  },
})
export class BitPasswordInputToggleDirective implements AfterContentInit, OnChanges {
  private readonly button = inject(BitIconButtonComponent, { host: true });
  private readonly formField = inject(BitFormFieldComponent);
  private readonly i18nService = inject(I18nService);

  /**
   * Whether the input is toggled to show the password.
   */
  readonly toggled = model(false);

  protected readonly label = this.i18nService.t("toggleVisibility");

  /**
   * Click handler to toggle the state of the input type.
   */
  onClick() {
    this.toggled.update((toggled) => !toggled);

    this.update();
  }

  private get icon() {
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
