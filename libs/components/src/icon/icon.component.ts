import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

export const BitIconSize = Object.freeze({
  Xs: "xs",
  Sm: "sm",
  Md: "md",
  Lg: "lg",
  Xl: "xl",
} as const);

export type BitIconSize = (typeof BitIconSize)[keyof typeof BitIconSize];

@Component({
  selector: "bit-icon",
  standalone: true,
  host: {
    "[class]": "classList()",
    "[attr.aria-hidden]": "ariaLabel() ? null : true",
    "[attr.aria-label]": "ariaLabel()",
  },
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitIconComponent {
  /**
   * The Bitwarden icon name (e.g., "bwi-lock", "bwi-user")
   */
  readonly icon = input.required<BitwardenIcon>();

  /**
   * Whether the icon should have a fixed width for alignment
   */
  readonly fw = input<boolean>(false);

  /**
   * Icon size - applies bwi-* size classes
   */
  readonly size = input<BitIconSize>();

  /**
   * Accessible label for the icon
   */
  readonly ariaLabel = input<string>();

  protected readonly classList = computed(() => {
    const classes = ["bwi", this.icon()];

    if (this.fw()) {
      classes.push("bwi-fw");
    }

    const size = this.size();
    if (size) {
      classes.push(`bwi-${size}`);
    }

    return classes.join(" ");
  });
}
