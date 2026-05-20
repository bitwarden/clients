import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  runInInjectionContext,
} from "@angular/core";

import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";

import { OnboardingService } from "./services/onboarding.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-welcome-modal-dialog",
  imports: [ButtonModule, TypographyModule, DialogModule, I18nPipe],
  templateUrl: "./welcome-modal-dialog.component.html",
})
export class WelcomeModalDialogComponent {
  private readonly dialogRef = inject(DialogRef<WelcomeModalDialogComponent>);
  private readonly onboardingService = inject(OnboardingService);

  protected async onStartTour() {
    // invoke the dialog here
    await this.dialogRef.close();
  }

  protected async onSkip() {
    await this.onboardingService
      .setWelcomeDialogAcknowledged()
      .then(() => {
        return this.dialogRef.close();
      })
      .catch(() => {});
  }

  static async showWelcomeDialog(
    injector: Injector,
    dialogService: DialogService,
  ): Promise<DialogRef<unknown, WelcomeModalDialogComponent> | undefined> {
    return runInInjectionContext(injector, async () => {
      const logger = inject(LogService);
      const onboardingService = inject(OnboardingService);
      const acknowledged = await onboardingService.isWelcomeDialogAcknowledged();
      if (acknowledged) {
        logger.info(
          "[Access Intelligence Onboarding] Welcome dialog already acknowledged, skipping dialog display.",
        );
        return;
      }

      const dialog = dialogService.open(WelcomeModalDialogComponent, {
        width: "600px",
        disableClose: true,
      });
      return dialog;
    });
  }
}
