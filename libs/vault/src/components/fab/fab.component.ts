import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  model,
} from "@angular/core";

import {
  BaseButtonDirective,
  BitwardenIcon,
  FocusableElement,
  IconComponent,
  TooltipDirective,
  setA11yTitleAndAriaLabel,
} from "@bitwarden/components";

@Component({
  selector: "button[vaultFab]",
  templateUrl: "fab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: FocusableElement, useExisting: VaultFabComponent }],
  imports: [IconComponent],
  host: {
    "[attr.vaultFab]": "vaultFab()",
    class:
      "tw-relative tw-inline-flex tw-items-center tw-justify-center tw-shrink-0 tw-size-12 tw-rounded-full tw-shadow-md",
  },
  hostDirectives: [
    { directive: TooltipDirective, inputs: ["tooltipPosition"] },
    { directive: BaseButtonDirective },
  ],
})
export class VaultFabComponent implements FocusableElement {
  private readonly baseButton = inject(BaseButtonDirective);
  private readonly elementRef = inject(ElementRef);
  private readonly tooltip = inject(TooltipDirective, { host: true, optional: true });

  /** The icon to display inside the FAB. */
  readonly vaultFab = model.required<BitwardenIcon>();

  /** Accessible label used for the tooltip and screen readers. */
  readonly label = input<string>();

  getFocusTarget() {
    return this.elementRef.nativeElement;
  }

  constructor() {
    // Currently the only supported variant of the FAB is "primary".
    // When others are needed this can be an `input` accepting various types.
    this.baseButton.buttonType.set("primary");

    const originalTitle = this.elementRef.nativeElement.getAttribute("title");

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
