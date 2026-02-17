import { Component, ChangeDetectionStrategy, input, computed } from "@angular/core";

import { IconComponent } from "../icon";
import { BitwardenIcon } from "../shared/icon";

import { ChipSize, ChipSizes } from "./base-chip.directive";

/**
 * `<bit-chip-content>` is a content wrapper component that provides consistent chip styling
 * and layout with support for icons, custom content slots, and dismiss functionality.
 *
 * @internal only to be used within lib/components
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
  readonly startIcon = input<BitwardenIcon>();

  readonly endIcon = input<BitwardenIcon>();

  readonly size = input<ChipSize>(ChipSizes.Large);

  readonly dismissible = input<boolean>(false);

  protected readonly ChipSizes = ChipSizes;

  protected readonly gapClass = computed(() =>
    this.size() === ChipSizes.Large ? "tw-gap-1.5" : "tw-gap-1",
  );

  protected readonly classList = computed(() => {
    return [
      "tw-inline-flex",
      "tw-min-w-0",
      "tw-w-full",
      "tw-max-w-full",
      "tw-items-center",
      "tw-justify-between",
      this.gapClass(),
    ].join(" ");
  });
}
