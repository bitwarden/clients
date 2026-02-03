import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { ApplicationRef, ComponentRef, Injectable, Injector, OnDestroy } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { map } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";

import { CoachmarkStep, COACHMARK_STEPS } from "./coachmark-step";
import { CoachmarkComponent } from "./coachmark.component";

/** State key for tracking coachmark tour completion */
const COACHMARK_TOUR_COMPLETED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "coachmarkTourCompleted",
  {
    deserializer: (value) => value ?? false,
    clearOn: [],
  },
);

@Injectable({
  providedIn: "root",
})
export class CoachmarkService implements OnDestroy {
  private overlayRef: OverlayRef | null = null;
  private coachmarkComponentRef: ComponentRef<CoachmarkComponent> | null = null;
  private currentStepIndex = 0;
  private applicableSteps: CoachmarkStep[] = [];
  private isRunning = false;

  constructor(
    private overlay: Overlay,
    private injector: Injector,
    private appRef: ApplicationRef,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private stateProvider: StateProvider,
    private i18nService: I18nService,
  ) {}

  /**
   * Starts the coachmark tour if it hasn't been completed yet.
   * The tour will display steps based on user type (org vs non-org).
   */
  async startTour(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    // Check if tour has already been completed
    const completed = await firstValueFrom(
      this.stateProvider
        .getUserState$(COACHMARK_TOUR_COMPLETED_KEY, account.id)
        .pipe(map((v) => v ?? false)),
    );

    if (completed) {
      return;
    }

    // Determine which steps to show based on organization membership
    const hasOrganizations = await firstValueFrom(
      this.organizationService.hasOrganizations(account.id),
    );

    this.applicableSteps = COACHMARK_STEPS.filter(
      (step) => !step.requiresOrganization || hasOrganizations,
    );

    if (this.applicableSteps.length === 0) {
      return;
    }

    this.isRunning = true;
    this.currentStepIndex = 0;
    await this.showCurrentStep();
  }

  /**
   * Moves to the next step in the tour, or completes if on the last step.
   */
  async nextStep(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.applicableSteps.length) {
      await this.completeTour();
    } else {
      await this.showCurrentStep();
    }
  }

  /**
   * Moves to the previous step in the tour.
   */
  async previousStep(): Promise<void> {
    if (!this.isRunning || this.currentStepIndex === 0) {
      return;
    }

    this.currentStepIndex--;
    await this.showCurrentStep();
  }

  /**
   * Dismisses the tour without marking it as completed.
   * The tour will show again on next login.
   */
  dismissTour(): void {
    this.cleanup();
    this.isRunning = false;
  }

  /**
   * Completes the tour and persists the completion state.
   */
  async completeTour(): Promise<void> {
    this.cleanup();
    this.isRunning = false;

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account) {
      await this.stateProvider.setUserState(COACHMARK_TOUR_COMPLETED_KEY, true, account.id);
    }
  }

  /**
   * Resets the tour completion state, allowing it to be shown again.
   */
  async resetTour(): Promise<void> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account) {
      await this.stateProvider.setUserState(COACHMARK_TOUR_COMPLETED_KEY, false, account.id);
    }
  }

  private async showCurrentStep(): Promise<void> {
    this.cleanup();

    const step = this.applicableSteps[this.currentStepIndex];
    if (!step) {
      return;
    }

    // If the step has a parent group (e.g., nav accordion), expand it first
    if (step.parentGroupSelector) {
      await this.expandParentGroup(step.parentGroupSelector);
    }

    // Find the anchor element
    const anchorElement = document.querySelector(step.anchorSelector);
    if (!anchorElement) {
      // Skip this step if the element isn't available
      await this.nextStep();
      return;
    }

    // Create the overlay positioned relative to the anchor
    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: "tw-bg-black/40",
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(anchorElement)
        .withPositions(this.getPositions(step.position))
        .withLockedPosition(true)
        .withFlexibleDimensions(false)
        .withPush(true),
    });

    // Create and attach the coachmark component
    const portal = new ComponentPortal(CoachmarkComponent, null, this.injector);
    this.coachmarkComponentRef = this.overlayRef.attach(portal);

    // Configure the component using setInput for signal inputs
    this.coachmarkComponentRef.setInput("title", this.i18nService.t(step.titleKey));
    this.coachmarkComponentRef.setInput("description", this.i18nService.t(step.descriptionKey));
    this.coachmarkComponentRef.setInput("currentStep", this.currentStepIndex + 1);
    this.coachmarkComponentRef.setInput("totalSteps", this.applicableSteps.length);
    this.coachmarkComponentRef.setInput("learnMoreUrl", step.learnMoreUrl);
    this.coachmarkComponentRef.setInput("position", step.position);

    // Subscribe to events
    const instance = this.coachmarkComponentRef.instance;
    instance.closed.subscribe(() => this.dismissTour());
    instance.back.subscribe(() => this.previousStep());
    instance.next.subscribe(() => this.nextStep());

    // Close on backdrop click
    this.overlayRef.backdropClick().subscribe(() => this.dismissTour());

    // Close on escape key
    this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === "Escape") {
        this.dismissTour();
      }
    });
  }

  private getPositions(position: CoachmarkStep["position"]) {
    const OFFSET = 14;

    const positions: Record<CoachmarkStep["position"], any[]> = {
      "above-center": [
        {
          offsetY: -OFFSET,
          originX: "center",
          originY: "top",
          overlayX: "center",
          overlayY: "bottom",
          panelClass: ["bit-popover-above", "bit-popover-above-center"],
        },
      ],
      "below-center": [
        {
          offsetY: OFFSET,
          originX: "center",
          originY: "bottom",
          overlayX: "center",
          overlayY: "top",
          panelClass: ["bit-popover-below", "bit-popover-below-center"],
        },
      ],
      "left-center": [
        {
          offsetX: -OFFSET,
          originX: "start",
          originY: "center",
          overlayX: "end",
          overlayY: "center",
          panelClass: ["bit-popover-left", "bit-popover-left-center"],
        },
      ],
      "right-center": [
        {
          offsetX: OFFSET,
          originX: "end",
          originY: "center",
          overlayX: "start",
          overlayY: "center",
          panelClass: ["bit-popover-right", "bit-popover-right-center"],
        },
      ],
    };

    return positions[position];
  }

  private cleanup(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
    this.coachmarkComponentRef = null;
  }

  /**
   * Expands a parent nav group (accordion) if it's collapsed.
   * This ensures the anchor element is visible before showing the coachmark.
   */
  private async expandParentGroup(selector: string): Promise<void> {
    const parentGroup = document.querySelector(selector);
    if (!parentGroup) {
      return;
    }

    // bit-nav-group uses a toggle button with aria-expanded to control expansion
    // Find the toggle button and check its aria-expanded state
    const toggleButton = parentGroup.querySelector("button[aria-expanded]");
    if (toggleButton && toggleButton.getAttribute("aria-expanded") === "false") {
      toggleButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      // Wait for animation to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
