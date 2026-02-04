import { Component, ChangeDetectionStrategy, input, computed } from "@angular/core";

import { IconComponent } from "../icon";

import { ChipSize, ChipSizes } from "./base-chip.directive";

/**
 * `<bit-chip-content>` is a content wrapper component that provides consistent chip styling
 * and layout with support for icons, custom content slots, and dismiss functionality.
 */
@Component({
  selector: "bit-chip-content, [bitChipContent]",
  standalone: true,
  templateUrl: "./chip-content.component.html",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "classList()",
  },
})
export class ChipContentComponent {
  /** Icon class to show at start (e.g., 'bwi-folder') */
  readonly startIcon = input<string>();

  /** Icon class to show at end (e.g., 'bwi-angle-down') */
  readonly endIcon = input<string>();

  readonly size = input<ChipSize>(ChipSizes.Large);

  protected readonly classList = computed(() => {
    const gapClass = this.size() === ChipSizes.Large ? "tw-gap-1.5" : "tw-gap-1";
    return ["tw-inline-flex", "tw-min-w-0", "tw-max-w-full", "tw-items-center", gapClass].join(" ");
  });
}
