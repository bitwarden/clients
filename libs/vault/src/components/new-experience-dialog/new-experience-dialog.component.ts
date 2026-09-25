import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DarkImageSourceDirective } from "../dark-image-source.directive";

export const NewExperienceDialogResult = {
  /** The user chose to explore the redesigned vault. */
  Explore: "explore",
  /** The user closed the dialog without exploring. */
  Dismissed: "dismissed",
} as const;

export type NewExperienceDialogResult = UnionOfValues<typeof NewExperienceDialogResult>;

export type NewExperienceDialogParams = {
  /** Screenshot shown under the light theme. Supplied by the client so each one can ship its own. */
  lightImgSrc: string;
  /** Screenshot shown under the dark theme. */
  darkImgSrc: string;
};

// TODO(https://bitwarden.atlassian.net/browse/PM-43953): Confirm the final help center article
// with Product before release.
export const NEW_EXPERIENCE_LEARN_MORE_URL = "https://bitwarden.com/help/";

/**
 * Announces the redesigned vault to users who created their account before the redesign shipped.
 *
 * Deliberately opened without a `positionStrategy` so that `DialogService`'s default
 * `ResponsivePositionStrategy` applies: below the `md` breakpoint — which the extension popup
 * always is — the dialog renders as a bottom sheet.
 */
@Component({
  selector: "vault-new-experience-dialog",
  templateUrl: "./new-experience-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DarkImageSourceDirective, DialogModule, I18nPipe, TypographyModule],
})
export class NewExperienceDialogComponent {
  private readonly dialogRef = inject<DialogRef<NewExperienceDialogResult>>(DialogRef);

  protected readonly params = inject<NewExperienceDialogParams>(DIALOG_DATA);

  protected readonly learnMoreUrl = NEW_EXPERIENCE_LEARN_MORE_URL;

  protected async explore() {
    await this.dialogRef.close(NewExperienceDialogResult.Explore);
  }

  /**
   * `bit-dialog`'s header close button, the escape key and the backdrop all close without a value,
   * so anything short of an explicit "explore" reports as
   * {@link NewExperienceDialogResult.Dismissed}.
   */
  static async open(
    dialogService: DialogService,
    params: NewExperienceDialogParams,
  ): Promise<NewExperienceDialogResult> {
    const dialogRef = dialogService.open<NewExperienceDialogResult, NewExperienceDialogParams>(
      NewExperienceDialogComponent,
      { data: params },
    );

    const result = await firstValueFrom(dialogRef.closed);

    return result ?? NewExperienceDialogResult.Dismissed;
  }
}
