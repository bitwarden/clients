import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

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
export class IconComponent {
  /**
   * The Bitwarden icon name (e.g., "bwi-lock", "bwi-user")
   */
  readonly name = input.required<BitwardenIcon>();

  /**
   * Accessible label for the icon
   */
  readonly ariaLabel = input<string>();

  protected readonly classList = computed(() => {
    return ["bwi", this.name()].join(" ");
  });
}
