import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DarkImageSourceDirective } from "../dark-image-source.directive";

export const NewExperienceDialogResult = {
  /** The user chose to explore the redesigned vault. */
  Explore: "explore",
  /** The user opened the "learn more" link. */
  LearnMore: "learnMore",
  /** The user closed the dialog from the header close button. */
  Dismissed: "dismissed",
} as const;

export type NewExperienceDialogResult = UnionOfValues<typeof NewExperienceDialogResult>;

export type NewExperienceDialogParams = {
  /** The user whose {@link NudgeType.Vfo1NewExperience} nudge is dismissed by the dialog's actions. */
  userId: UserId;
  /** Screenshot shown under the light theme. Supplied by the client so each one can ship its own. */
  lightImgSrc: string;
  /** Screenshot shown under the dark theme. */
  darkImgSrc: string;
};

export const NEW_EXPERIENCE_LEARN_MORE_URL = "https://bitwarden.com/blog/2026-design-update";

/**
 * Announces the redesigned vault to users who created their account before the redesign shipped.
 *
 * The nudge is dismissed only by an explicit action: exploring, learning more, or the header close
 * button. The dialog is opened with `disableClose` so escape and backdrop clicks can't close it
 * without one of those, which also hides `bit-dialog`'s built-in close button — this component
 * renders its own in its place.
 *
 * Deliberately opened without a `positionStrategy` so that `DialogService`'s default
 * `ResponsivePositionStrategy` applies: below the `md` breakpoint — which the extension popup
 * always is — the dialog renders as a bottom sheet.
 */
@Component({
  selector: "vault-new-experience-dialog",
  templateUrl: "./new-experience-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    DarkImageSourceDirective,
    DialogModule,
    I18nPipe,
    IconButtonModule,
    TypographyModule,
  ],
})
export class NewExperienceDialogComponent {
  private readonly dialogRef = inject<DialogRef<NewExperienceDialogResult>>(DialogRef);
  private readonly nudgesService = inject(NudgesService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly params = inject<NewExperienceDialogParams>(DIALOG_DATA);

  protected readonly learnMoreUrl = NEW_EXPERIENCE_LEARN_MORE_URL;

  protected async explore() {
    await this.dismiss(NewExperienceDialogResult.Explore);
  }

  /**
   * Dismisses the nudge before opening the link: the new tab tears down the extension popup, so the
   * dismissal has to land first.
   */
  protected async learnMore(event: MouseEvent) {
    event.preventDefault();
    await this.nudgesService.dismissNudge(NudgeType.Vfo1NewExperience, this.params.userId);
    this.platformUtilsService.launchUri(this.learnMoreUrl);
    await this.dialogRef.close(NewExperienceDialogResult.LearnMore);
  }

  protected async close() {
    await this.dismiss(NewExperienceDialogResult.Dismissed);
  }

  private async dismiss(result: NewExperienceDialogResult) {
    await this.nudgesService.dismissNudge(NudgeType.Vfo1NewExperience, this.params.userId);
    await this.dialogRef.close(result);
  }

  static async open(
    dialogService: DialogService,
    params: NewExperienceDialogParams,
  ): Promise<NewExperienceDialogResult | undefined> {
    const dialogRef = dialogService.open<NewExperienceDialogResult, NewExperienceDialogParams>(
      NewExperienceDialogComponent,
      { data: params, disableClose: true },
    );

    return await firstValueFrom(dialogRef.closed);
  }
}
