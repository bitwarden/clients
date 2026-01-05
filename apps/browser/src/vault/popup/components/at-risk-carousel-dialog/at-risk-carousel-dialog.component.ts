import { Component, inject, signal } from "@angular/core";

import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
  CenterPositionStrategy,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { DarkImageSourceDirective, VaultCarouselModule } from "@bitwarden/vault";

export const AtRiskCarouselDialogResult = {
  Dismissed: "dismissed",
} as const;

type AtRiskCarouselDialogResult = UnionOfValues<typeof AtRiskCarouselDialogResult>;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-at-risk-carousel-dialog",
  templateUrl: "./at-risk-carousel-dialog.component.html",
  imports: [
    DialogModule,
    VaultCarouselModule,
    TypographyModule,
    ButtonModule,
    DarkImageSourceDirective,
    I18nPipe,
  ],
})
export class AtRiskCarouselDialogComponent {
  private dialogRef = inject(DialogRef);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  protected dismissBtnEnabled = signal(false);

  protected async dismiss() {
    this.dialogRef.close(AtRiskCarouselDialogResult.Dismissed);
  }

  protected onSlideChange(slideIndex: number) {
    // Only enable the dismiss button on the last slide
    if (slideIndex === 2) {
      this.dismissBtnEnabled.set(true);
    }
  }

  static open(dialogService: DialogService) {
    return dialogService.open<AtRiskCarouselDialogResult>(AtRiskCarouselDialogComponent, {
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
