import { NgClass } from "@angular/common";
import { Component, inject, ElementRef, computed } from "@angular/core";

import { AriaDisableDirective } from "../a11y";
import { BaseButtonDirective, getButtonSizeStyles } from "../shared/base-button.directive";
import { ButtonLikeAbstraction, ButtonSize } from "../shared/button-like.abstraction";
import { SpinnerComponent } from "../spinner";
import { ariaDisableElement } from "../utils";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  imports: [NgClass, SpinnerComponent],
  host: {
    "[class]": "classList()",
  },
  hostDirectives: [
    AriaDisableDirective,
    {
      directive: BaseButtonDirective,
      inputs: ["loading", "disabled", "buttonType", "size", "block"],
    },
  ],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  private baseButton = inject(BaseButtonDirective);
  private el = inject(ElementRef<HTMLButtonElement>);

  // Expose loading and disabled from base directive for ButtonLikeAbstraction
  readonly loading = this.baseButton.loading;
  readonly disabled = this.baseButton.disabled;

  protected get showLoadingStyle() {
    return this.baseButton.showLoadingStyle;
  }

  protected readonly classList = computed(() => {
    const classes: string[] = [];

    // Add block/inline styles
    if (this.baseButton.block()) {
      classes.push("tw-w-full", "tw-block");
    } else {
      classes.push("tw-inline-block");
    }

    // Add size styles (color and disabled styles are applied by BaseButtonDirective)
    classes.push(...getButtonSizeStyles(this.baseButton.size() as ButtonSize));

    return classes.join(" ");
  });

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.baseButton.disabledAttr);
  }
}
