import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  model,
} from "@angular/core";

import { AriaDisableDirective } from "../a11y";
import { setA11yTitleAndAriaLabel } from "../a11y/set-a11y-title-and-aria-label";
import { IconComponent } from "../icon";
import { BaseButtonDirective } from "../shared/base-button.directive";
import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";
import { FocusableElement } from "../shared/focusable-element";
import { BitwardenIcon } from "../shared/icon";
import { TooltipDirective } from "../tooltip";
import { ariaDisableElement } from "../utils";

@Component({
  selector: "button[bitFab]",
  templateUrl: "fab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: ButtonLikeAbstraction, useExisting: BitFabComponent },
    { provide: FocusableElement, useExisting: BitFabComponent },
  ],
  imports: [IconComponent],
  host: {
    "[attr.bitFab]": "bitFab()",
    class:
      "tw-relative tw-inline-flex tw-items-center tw-justify-center tw-shrink-0 tw-size-12 tw-rounded-full tw-shadow-md",
  },
  hostDirectives: [
    AriaDisableDirective,
    { directive: TooltipDirective, inputs: ["tooltipPosition"] },
    {
      directive: BaseButtonDirective,
      inputs: ["disabled"],
    },
  ],
})
export class BitFabComponent implements ButtonLikeAbstraction, FocusableElement {
  private readonly baseButton = inject(BaseButtonDirective);
  private readonly elementRef = inject(ElementRef);
  private readonly tooltip = inject(TooltipDirective, { host: true, optional: true });

  /** The icon to display inside the FAB. */
  readonly bitFab = model.required<BitwardenIcon>();

  /** Accessible label used for the tooltip and screen readers. */
  readonly label = input<string>();

  readonly loading = this.baseButton.loading;
  readonly disabled = this.baseButton.disabled;

  getFocusTarget() {
    return this.elementRef.nativeElement;
  }

  constructor() {
    const element = this.elementRef.nativeElement;

    // Currently the only supported variant of the FAB is "primary".
    // When other's are needed this can be an `input` accepting various types.
    this.baseButton.buttonType.set("primary");

    ariaDisableElement(element, this.baseButton.disabledAttr);

    const originalTitle = element.getAttribute("title");

    effect(() => {
      setA11yTitleAndAriaLabel({
        element: this.elementRef.nativeElement,
        title: undefined,
        label: this.label(),
      });

      const tooltipContent: string = originalTitle || this.label();

      if (tooltipContent) {
        this.tooltip?.tooltipContent.set(tooltipContent);
      }
    });
  }
}
