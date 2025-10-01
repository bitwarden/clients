import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  inject,
  InjectionToken,
  Signal,
  TemplateRef,
  viewChild,
} from "@angular/core";

import { TooltipPosition } from "./tooltip-positions";

type TooltipData = {
  content: Signal<string>;
  isVisible: Signal<boolean>;
  tooltipPosition: Signal<TooltipPosition>;
};

export const TOOLTIP_DATA = new InjectionToken<TooltipData>("TOOLTIP_DATA");

/**
 * tooltip component used internally by the tooltip.directive. Not meant to be used explicitly
 */
@Component({
  selector: "bit-tooltip",
  templateUrl: "./tooltip.component.html",
  imports: [CommonModule],
})
export class TooltipComponent {
  readonly templateRef = viewChild.required(TemplateRef);

  private elementRef = inject(ElementRef<HTMLDivElement>);

  readonly tooltipData = inject<TooltipData>(TOOLTIP_DATA);
}
