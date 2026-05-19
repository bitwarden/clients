import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  DIALOG_DATA,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultCarouselModule } from "@bitwarden/vault";

import { OnboardingService } from "./services/onboarding.service";

export type WelcomeCarouselDialogData = {
  organizationId: OrganizationId;
};

const TOTAL_SLIDES = 4;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-welcome-carousel-dialog",
  imports: [ButtonModule, DialogModule, I18nPipe, TypographyModule, VaultCarouselModule],
  templateUrl: "./welcome-carousel-dialog.component.html",
})
export class WelcomeCarouselDialogComponent {
  private readonly dialogRef = inject(DialogRef<WelcomeCarouselDialogComponent>);
  private readonly router = inject(Router);
  private readonly onboardingService = inject(OnboardingService);
  private readonly data = inject<WelcomeCarouselDialogData>(DIALOG_DATA);

  protected readonly currentSlide = signal(0);
  protected readonly isFirstSlide = computed(() => this.currentSlide() === 0);
  protected readonly isLastSlide = computed(() => this.currentSlide() === TOTAL_SLIDES - 1);

  protected onSlideChange(index: number): void {
    this.currentSlide.set(index);
  }

  protected async onSkip(): Promise<void> {
    await this.onboardingService.setCarouselAcknowledged();
    await this.dialogRef.close();
  }

  protected async onImportData(): Promise<void> {
    await this.onboardingService.setCarouselAcknowledged();
    await this.dialogRef.close();
    await this.router.navigate(
      ["/organizations", this.data.organizationId, "settings", "tools", "import"],
      { queryParams: { returnTo: "access-intelligence" } },
    );
  }

  static open(
    dialogService: DialogService,
    organizationId: OrganizationId,
  ): DialogRef<WelcomeCarouselDialogComponent> {
    return dialogService.open(WelcomeCarouselDialogComponent, {
      data: { organizationId } satisfies WelcomeCarouselDialogData,
      width: "600px",
      disableClose: true,
    });
  }
}
