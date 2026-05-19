import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  isDevMode,
  OnInit,
  output,
  signal,
} from "@angular/core";

import { BadgeModule } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { OnboardingService } from "../onboarding/services/onboarding.service";

/*This component is a dev menu only.
 * It is not intended for production use and will be removed before release a
 * after the feature flag is removed. It is only intended for use in development and testing.
 * No language translations are required and therefore no use of i18n pipe or service.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-dev-menu",
  templateUrl: "./dev-menu.component.html",
  imports: [BadgeModule],
})
export class DevMenuComponent implements OnInit {
  private readonly elementRef = inject(ElementRef);
  private readonly onboardingService = inject(OnboardingService);
  private readonly logger = inject(LogService);
  protected readonly welcomeDialogAcked = signal(false);

  readonly beginTour = output<void>();
  readonly importData = output<void>();
  protected readonly isOpen = signal(false);

  async ngOnInit(): Promise<void> {
    const isAck = await this.onboardingService.isWelcomeDialogAcknowledged();
    this.welcomeDialogAcked.set(isAck);
  }

  @HostListener("document:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent): void {
    if (!isDevMode()) {
      return;
    }
    if (event.shiftKey && event.key === "?") {
      this.isOpen.update((open) => !open);
    } else if (event.key === "Escape") {
      this.isOpen.set(false);
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    if (!isDevMode()) {
      return;
    }
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  protected onBeginTour(): void {
    this.isOpen.set(false);
    this.beginTour.emit();
  }

  protected onImportData(): void {
    this.isOpen.set(false);
    this.importData.emit();
  }

  protected async onResetWelcomeDialogAck(): Promise<void> {
    try {
      await this.onboardingService.setWelcomeDialogAcknowledged(false);
      this.welcomeDialogAcked.set(false);
      this.logger.info("Reset Access Intelligence welcome dialog acknowledged state.");
    } catch (error) {
      this.logger.error(
        "Failed to reset Access Intelligence welcome dialog acknowledged state.",
        error,
      );
    }
  }

  protected async onShowWelcomeDialogAckState(): Promise<void> {
    try {
      const isAck = await this.onboardingService.isWelcomeDialogAcknowledged();
      this.welcomeDialogAcked.set(isAck);
      this.logger.info(`Access Intelligence welcome dialog acknowledged state: ${isAck}.`);
    } catch (error) {
      this.logger.error(
        "Failed to get Access Intelligence welcome dialog acknowledged state.",
        error,
      );
    }
  }
}
