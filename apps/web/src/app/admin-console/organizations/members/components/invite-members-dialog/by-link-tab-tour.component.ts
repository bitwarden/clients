import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, output, signal } from "@angular/core";

import {
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  LinkComponent,
  PopoverModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

const TOTAL_TOUR_STEPS = 3;
type TourStep = 0 | 1 | 2 | 3;

const DUMMY_ALLOWED_DOMAINS = "acme.com, acme.eu, acme.fr, acme.uk";
const DUMMY_INVITE_LINK_URL = "https://vault.bitwarden.com/invite-link/example";

/**
 * TODO(guided-tour removal): this whole component is temporary. It exists only to back the
 * "by link" guided tour and has no purpose once that tour is retired. To remove it cleanly:
 * 1. Delete this file, by-link-tab-tour.component.html, and by-link-tab-tour.component.spec.ts.
 * 2. Search the repo for the literal string `guided-tour removal` and address every other site
 *    that comment appears — they cover:
 *    - InviteMembersDialogComponent (.ts and .html): the tab/footer @if/@else swap,
 *      `showCoachMarks` field on `InviteMembersDialogParams`, the `selectedTabIndex` ternary, and
 *      the `finishTour()` method.
 *    - MemberDialogManagerService.openInviteDialog(): the `showCoachMarks` parameter.
 *    - InviteLinkCalloutService.showIfEligible(): the `originUrl` capture/restore — the splash
 *      dialog itself and the call to open the invite dialog are permanent and must stay.
 *    - InviteLinkCalloutDialogComponent (.ts and .html): the tour-preview notice paragraph and
 *      its now-unused TypographyModule import.
 *    - The `tourPreviewExampleDomainsNotice` and `inviteLinkCalloutTourPreviewNotice` keys in
 *      apps/web/src/locales/en/messages.json (messages.json has no comments, so this is the only
 *      place those two keys are flagged — delete them manually).
 * No other app depends on this component or its output; nothing else needs to change.
 *
 * A fully static stand-in for {@link ByLinkTabComponent}, used only to render the "by link"
 * guided tour. It mirrors the real tab's layout with hardcoded example data and never calls any
 * backend service — the coach marks are the only interactive surface; everything else is wrapped
 * in `inert` so it looks normal but can't be clicked, focused, or tabbed into.
 */
@Component({
  standalone: true,
  selector: "app-by-link-tab-tour",
  templateUrl: "by-link-tab-tour.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    LinkComponent,
    NgTemplateOutlet,
    PopoverModule,
  ],
})
export class ByLinkTabTourComponent {
  protected readonly dummyAllowedDomains = DUMMY_ALLOWED_DOMAINS;
  protected readonly dummyInviteLinkUrl = DUMMY_INVITE_LINK_URL;
  protected readonly totalTourSteps = TOTAL_TOUR_STEPS;

  protected readonly tourStep = signal<TourStep>(0);

  readonly tourFinished = output<void>();

  constructor() {
    // HACK: the dialog is still animating into place when this component mounts, so the step 1
    // popover's `flexibleConnectedTo` position strategy can anchor to the save button's stale
    // pre-animation rect and render in the wrong spot. Wait for the dialog's open animation to
    // settle before opening the first coach mark.
    setTimeout(() => this.tourStep.set(1), 250);
  }

  protected back(): void {
    if (this.tourStep() > 1) {
      this.tourStep.set((this.tourStep() - 1) as TourStep);
    }
  }

  protected next(): void {
    if (this.tourStep() < TOTAL_TOUR_STEPS) {
      this.tourStep.set((this.tourStep() + 1) as TourStep);
      return;
    }
    this.tourFinished.emit();
  }
}
