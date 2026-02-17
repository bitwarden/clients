import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from "@angular/core";

import { AriaDisableDirective } from "../a11y/aria-disable.directive";
import { IconComponent } from "../icon/icon.component";
import { ariaDisableElement } from "../utils/aria-disable-element";

@Component({
  selector: "button[bit-chip-dismiss-button]",
  standalone: true,
  imports: [IconComponent],
  host: {
    class:
      "tw-size-5 tw-bg-transparent hover:tw-bg-hover-contrast tw-outline-none tw-rounded-md tw-p-0.5 tw-text-[color:inherit] tw-text-[length:inherit] tw-border-solid tw-border tw-border-transparent tw-flex tw-items-center tw-justify-center focus-visible:tw-ring-2 tw-ring-border-focus hover:disabled:tw-bg-transparent",
    "[class.tw-cursor-not-allowed]": "disabled()",
  },
  hostDirectives: [AriaDisableDirective],
  template: ` <bit-icon name="bwi-close" class="tw-text-xs" /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipDismissButtonComponent {
  readonly disabled = input<boolean>(false);
  private el = inject(ElementRef<HTMLButtonElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }
}
