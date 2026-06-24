import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  runInInjectionContext,
} from "@angular/core";

import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
  DIALOG_DATA,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessIntelligenceCoachmarkService } from "./access-intelligence-coachmark.service";
import { OnboardingService } from "./services/onboarding.service";

export type PostImportModalDialogData = {
  organizationId: OrganizationId;
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-post-import-modal-dialog",
  imports: [ButtonModule, TypographyModule, DialogModule, I18nPipe],
  templateUrl: "./post-import-modal-dialog.component.html",
})
export class PostImportModalDialogComponent {
  private readonly dialogRef = inject(DialogRef<PostImportModalDialogComponent>);
  private readonly onboardingService = inject(OnboardingService);
  private readonly coachmarkService = inject(AccessIntelligenceCoachmarkService);
  private readonly data = inject<PostImportModalDialogData>(DIALOG_DATA);
  private readonly logger = inject(LogService);

  protected async onStartTour(): Promise<void> {
    await this.onboardingService.setPostImportDialogAcknowledged();
    await this.coachmarkService.startTour(this.data.organizationId);
    await this.dialogRef.close();
  }

  protected async onSkip(): Promise<void> {
    await this.onboardingService
      .setPostImportDialogAcknowledged()
      .then(() => {
        return this.dialogRef.close();
      })
      .catch((error: unknown) => {
        this.logger.error(
          "[Post Import Modal Dialog] Error acknowledging post-import dialog",
          error,
        );
      });
  }

  static async showDialog(
    injector: Injector,
    dialogService: DialogService,
    organizationId: OrganizationId,
  ): Promise<DialogRef<unknown, PostImportModalDialogComponent> | undefined> {
    return runInInjectionContext(injector, async () => {
      const logger = inject(LogService);
      const onboardingService = inject(OnboardingService);
      const acknowledged = await onboardingService.isPostImportDialogAcknowledged();
      if (acknowledged) {
        logger.info(
          "[Access Intelligence Onboarding] Welcome dialog already acknowledged, skipping dialog display.",
        );
        return;
      }

      const dialog = dialogService.open(PostImportModalDialogComponent, {
        data: { organizationId } satisfies PostImportModalDialogData,
        width: "600px",
        disableClose: true,
      });
      return dialog;
    });
  }
}
