import {
  Component,
  ChangeDetectionStrategy,
  booleanAttribute,
  input,
  inject,
  ElementRef,
} from "@angular/core";

import { AriaDisableDirective } from "../../a11y";
import { BitwardenIcon } from "../../shared/icon";
import { ariaDisableElement } from "../../utils/aria-disable-element";
import {
  BaseChipDirective,
  type ChipVariant,
  type ChipSize,
  ChipVariants,
  ChipSizes,
} from "../base-chip.directive";
import { ChipContentComponent } from "../chip-content.component";

@Component({
  selector: "a[bitChipAction], button[bitChipAction]",
  standalone: true,
  imports: [ChipContentComponent],
  templateUrl: "./chip-action.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["variant", "size"],
    },
    AriaDisableDirective,
  ],
})
export class ChipActionComponent {
  readonly variant = input<ChipVariant>(ChipVariants.Primary);
  readonly size = input<ChipSize>(ChipSizes.Large);

  // Behavioral inputs
  readonly disabled = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly fullWidth = input<boolean, unknown>(false, { transform: booleanAttribute });

  // Content inputs
  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();
  readonly label = input<string>("");

  private el = inject(ElementRef<HTMLButtonElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }
}
