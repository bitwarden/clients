import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  runInInjectionContext,
  signal,
} from "@angular/core";
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
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultCarouselModule } from "@bitwarden/vault";

import { OnboardingService } from "./services/onboarding.service";

export type NewAdminWelcomeCarouselDialogData = {
  organizationId: OrganizationId;
};

const TOTAL_SLIDES = 4;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-new-admin-welcome-dialog",
  imports: [ButtonModule, DialogModule, I18nPipe, TypographyModule, VaultCarouselModule],
  templateUrl: "./new-admin-welcome-dialog.component.html",
})
export class NewAdminWelcomeDialogComponent {
  private readonly dialogRef = inject(DialogRef<NewAdminWelcomeDialogComponent>);
  private readonly router = inject(Router);
  private readonly onboardingService = inject(OnboardingService);
  private readonly data = inject<NewAdminWelcomeCarouselDialogData>(DIALOG_DATA);

  protected readonly currentSlide = signal(0);
  protected readonly isFirstSlide = computed(() => this.currentSlide() === 0);
  protected readonly isLastSlide = computed(() => this.currentSlide() === TOTAL_SLIDES - 1);

  protected onSlideChange(index: number): void {
    this.currentSlide.set(index);
  }

  protected async onSkip(): Promise<void> {
    await this.onboardingService.setNewAdminWelcomeDialogAcknowledged();
    await this.dialogRef.close();
  }

  protected async onImportData(): Promise<void> {
    await this.onboardingService.setNewAdminWelcomeDialogAcknowledged();
    await this.dialogRef.close();
    await this.router.navigate(
      ["/organizations", this.data.organizationId, "settings", "tools", "import"],
      { queryParams: { returnTo: "access-intelligence" } },
    );
  }

  static async showDialog(
    injector: Injector,
    dialogService: DialogService,
    organizationId: OrganizationId,
  ): Promise<DialogRef<unknown, NewAdminWelcomeDialogComponent> | undefined> {
    return runInInjectionContext(injector, async () => {
      const logger = inject(LogService);
      const onboardingService = inject(OnboardingService);
      const acknowledged = await onboardingService.isNewAdminWelcomeDialogAcknowledged();
      if (acknowledged) {
        logger.info(
          "[Access Intelligence Onboarding] Welcome dialog already acknowledged, skipping dialog display.",
        );
        return;
      }

      const dialog = dialogService.open(NewAdminWelcomeDialogComponent, {
        data: { organizationId } satisfies NewAdminWelcomeCarouselDialogData,
        width: "600px",
        disableClose: true,
      });
      return dialog;
    });
  }
}
