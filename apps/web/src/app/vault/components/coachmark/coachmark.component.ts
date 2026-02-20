import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, viewChild } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  LinkModule,
  PopoverComponent,
  PopoverModule,
  TypographyModule,
} from "@bitwarden/components";

import { CoachmarkStepId } from "./coachmark-step";
import { CoachmarkService } from "./coachmark.service";

/**
 * Self-contained coachmark tour step.
 * Wraps a `<bit-popover>` internally — use `coachmark.popover()` with `[bitPopoverAnchor]`.
 *
 * @example
 * ```html
 * <div [bitPopoverAnchor]="myCoachmark.popover()" [popoverOpen]="isOpen()">
 *   Highlighted element
 * </div>
 * <app-coachmark #myCoachmark stepId="importData" />
 * ```
 */
@Component({
  selector: "app-coachmark",
  standalone: true,
  imports: [CommonModule, JslibModule, ButtonModule, LinkModule, PopoverModule, TypographyModule],
  templateUrl: "coachmark.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: "coachmark",
})
export class CoachmarkComponent {
  /** Which coachmark step this instance represents */
  readonly stepId = input.required<CoachmarkStepId>();

  /** Exposed so parent templates can bind `[bitPopoverAnchor]="ref.popover()"` */
  readonly popover = viewChild.required(PopoverComponent);

  protected readonly service = inject(CoachmarkService);
}
