import { computed, signal } from "@angular/core";

import { PositionIdentifier } from "../popover";

export interface CoachmarkStep<TStepId extends string = string> {
  readonly id: TStepId;
  /** Preferred popover position for this step. */
  readonly position?: PositionIdentifier;
  /** Include the step only when this returns true. Checked once, when the tour starts. */
  readonly when?: () => boolean;
  /** Runs before the step shows, e.g. to open the container its anchor renders in. */
  readonly beforeEnter?: () => void;
  /** Runs when the tour leaves the step, e.g. to close that container. */
  readonly afterLeave?: () => void;
}

export interface CoachmarkTourOptions {
  /** Runs whenever the tour ends, whether finished or dismissed. Persist completion here. */
  readonly onEnd?: () => void;
}

/**
 * Step state for a coachmark tour. Holds no storage or eligibility logic: the consumer decides
 * when to `start()` and persists completion in `onEnd`.
 *
 * @example
 * ```ts
 * readonly tour = new CoachmarkTour([
 *   { id: "filters", position: "below-end" },
 *   { id: "filterRow", beforeEnter: () => this.dialogOpen.set(true), afterLeave: () => this.dialogOpen.set(false) },
 * ], { onEnd: () => this.saveTourCompleted() });
 * ```
 */
export class CoachmarkTour<TStepId extends string = string> {
  private readonly steps = signal<readonly CoachmarkStep<TStepId>[]>([]);
  private readonly index = signal(-1);

  readonly activeStep = computed(() => this.steps()[this.index()]);
  readonly running = computed(() => this.activeStep() !== undefined);
  /** 1-based; 0 while the tour isn't running. */
  readonly stepNumber = computed(() => this.index() + 1);
  readonly totalSteps = computed(() => this.steps().length);

  constructor(
    private readonly allSteps: readonly CoachmarkStep<TStepId>[],
    private readonly options: CoachmarkTourOptions = {},
  ) {}

  isActive(id: TStepId): boolean {
    return this.activeStep()?.id === id;
  }

  position(id: TStepId): PositionIdentifier | undefined {
    return this.allSteps.find((step) => step.id === id)?.position;
  }

  /** Starts at the first step whose `when` passes. No-op if running or no step applies. */
  start(): void {
    if (this.running()) {
      return;
    }
    const steps = this.allSteps.filter((step) => step.when?.() ?? true);
    if (!steps.length) {
      return;
    }
    this.steps.set(steps);
    this.goTo(0);
  }

  /** Advances, or ends the tour from the last step. */
  next(): void {
    if (!this.running()) {
      return;
    }
    if (this.index() === this.steps().length - 1) {
      this.end();
    } else {
      this.goTo(this.index() + 1);
    }
  }

  back(): void {
    if (this.index() > 0) {
      this.goTo(this.index() - 1);
    }
  }

  end(): void {
    if (!this.running()) {
      return;
    }
    this.activeStep()?.afterLeave?.();
    this.index.set(-1);
    this.steps.set([]);
    this.options.onEnd?.();
  }

  private goTo(index: number): void {
    this.activeStep()?.afterLeave?.();
    this.steps()[index].beforeEnter?.();
    this.index.set(index);
  }
}
