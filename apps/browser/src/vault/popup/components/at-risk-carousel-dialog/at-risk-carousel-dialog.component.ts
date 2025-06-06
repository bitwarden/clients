import { Component, inject, signal } from "@angular/core";

import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { DarkImageSourceDirective, VaultCarouselModule } from "@bitwarden/vault";

export const AtRiskCarouselDialogResult = {
  Dismissed: "dismissed",
} as const;

type AtRiskCarouselDialogResult = UnionOfValues<typeof AtRiskCarouselDialogResult>;

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
    });
  }
}
