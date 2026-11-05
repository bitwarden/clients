import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  FunctionReturningAwaitable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/** An approved request the requester has not started yet. */
@Component({
  selector: "app-pam-approved-request-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [AsyncActionsModule, ButtonModule, CardComponent, BannerCardHeaderComponent, I18nPipe],
  templateUrl: "./approved-request-card.component.html",
})
export class ApprovedRequestCardComponent {
  readonly startAction = input.required<FunctionReturningAwaitable>();

  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}
