import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, input, TemplateRef, viewChild } from "@angular/core";

import { AllowedTooltipPosition } from "../utils/overlay-positions";

@Component({
  selector: "bit-tooltip",
  standalone: true,
  templateUrl: "./tooltip.component.html",
  imports: [CommonModule],
})
export class TooltipComponent {
  readonly content = input<string>("");
  readonly isVisible = input<boolean>(false);
  protected tooltipPosition = input<AllowedTooltipPosition>("above-center");

  readonly templateRef = viewChild.required(TemplateRef);

  private elementRef = inject(ElementRef<HTMLDivElement>);
}
