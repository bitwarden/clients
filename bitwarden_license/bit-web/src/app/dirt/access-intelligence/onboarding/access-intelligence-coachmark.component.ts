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

import { AccessIntelligenceCoachmarkStepId } from "./access-intelligence-coachmark-step";
import { AccessIntelligenceCoachmarkService } from "./access-intelligence-coachmark.service";

/**
 * Self-contained coachmark tour step for Access Intelligence.
 * Wraps a `<bit-popover>` internally — use `coachmark.popover()` with `[bitPopoverAnchorFor]`.
 *
 * @example
 * ```html
 * <div [bitPopoverAnchorFor]="myCoachmark.popover()" [popoverOpen]="isOpen()">
 *   Highlighted element
 * </div>
 * <dirt-ai-coachmark #myCoachmark stepId="atRiskMembers" />
 * ```
 */
@Component({
  selector: "dirt-ai-coachmark",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./access-intelligence-coachmark.component.html",
  imports: [CommonModule, ButtonModule, I18nPipe, LinkModule, PopoverModule, TypographyModule],
  exportAs: "aiCoachmark",
})
export class AccessIntelligenceCoachmarkComponent {
  /** Which coachmark step this instance represents */
  readonly stepId = input.required<AccessIntelligenceCoachmarkStepId>();

  /** Exposed so parent templates can bind `[bitPopoverAnchorFor]="ref.popover()"` */
  readonly popover = viewChild.required(PopoverComponent);

  protected readonly service = inject(AccessIntelligenceCoachmarkService);
}
