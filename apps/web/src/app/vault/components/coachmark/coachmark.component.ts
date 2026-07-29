import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, viewChild } from "@angular/core";

import {
  ButtonModule,
  LinkModule,
  PopoverComponent,
  PopoverModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CoachmarkStepId } from "./coachmark-step";
import { CoachmarkService } from "./coachmark.service";

/**
 * Self-contained coachmark tour step.
 * Wraps a `<bit-popover>` internally — use `coachmark.popover()` with `[bitPopoverAnchorFor]`.
 *
 * @example
 * ```html
 * <div [bitPopoverAnchorFor]="myCoachmark.popover()" [popoverOpen]="isOpen()">
 *   Highlighted element
 * </div>
 * <app-coachmark #myCoachmark stepId="importData" />
 * ```
 */
@Component({
  selector: "app-coachmark",
  standalone: true,
  imports: [CommonModule, ButtonModule, I18nPipe, LinkModule, PopoverModule, TypographyModule],
  templateUrl: "coachmark.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: "coachmark",
})
export class CoachmarkComponent {
  /** Which coachmark step this instance represents */
  readonly stepId = input.required<CoachmarkStepId>();

  /** Exposed so parent templates can bind `[bitPopoverAnchorFor]="ref.popover()"` */
  readonly popover = viewChild.required(PopoverComponent);

  protected readonly service = inject(CoachmarkService);
}
