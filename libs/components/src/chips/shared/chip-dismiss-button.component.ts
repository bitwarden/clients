import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from "@angular/core";

import { AriaDisableDirective } from "../../a11y/aria-disable.directive";
import { IconComponent } from "../../icon/icon.component";
import { ariaDisableElement } from "../../utils/aria-disable-element";

/**
 * @internal This component is intended for internal use within the Chip component and is not exported for public use.
 */
@Component({
  selector: "button[bit-chip-dismiss-button]",
  imports: [IconComponent],
  host: {
    "[class]": "classList()",
    "[class.tw-cursor-not-allowed]": "disabled()",
  },
  hostDirectives: [AriaDisableDirective],
  template: ` <bit-icon name="bwi-close" /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipDismissButtonComponent {
  readonly disabled = input<boolean>(false);
  private readonly el = inject(ElementRef<HTMLButtonElement>);
  protected readonly size = input<"small" | "large">("large");

  readonly classList = computed(() => {
    const baseClasses = [
      "tw-bg-transparent",
      "hover:tw-bg-bg-hover",
      "focus-visible:tw-bg-bg-hover",
      "tw-outline-none",
      "tw-rounded-md",
      "tw-p-0.5",
      "tw-text-[color:inherit]",
      "tw-text-[length:inherit]",
      "tw-border-solid",
      "tw-border",
      "tw-border-transparent",
      "tw-flex",
      "tw-items-center",
      "tw-justify-center",
      "focus-visible:tw-ring-2",
      "tw-ring-border-focus",
      "hover:aria-disabled:tw-bg-transparent",
      "focus-visible:aria-disabled:tw-bg-transparent",
    ];
    const sizeClasses =
      this.size() === "small" ? ["tw-text-xs", "tw-size-4"] : ["tw-text-sm", "tw-size-5"];
    return [...baseClasses, ...sizeClasses];
  });

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }
}
