import { Injectable, computed, signal } from "@angular/core";

import { PopoverAnchorRef, PositionIdentifier } from "../popover";

export interface CoachmarkStep {
  readonly id: string;
  /** The element to spotlight, read while the step is active. The step waits while it's missing. */
  readonly anchor: PopoverAnchorRef;
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
 * Step state for one coachmark tour. Provide it on the component that owns the tour, where its
 * `bit-coachmark`s inject it; the consumer decides when to `start()` and persists in `onEnd`.
 *
 * @example
 * ```ts
 * @Component({ providers: [CoachmarkTourService], … })
 * class VaultComponent {
 *   private readonly tour = inject(CoachmarkTourService);
 *   private readonly toolbar = viewChild.required(BitTableToolbarComponent);
 *
 *   constructor() {
 *     this.tour.configure(
 *       [{ id: "filters", anchor: computed(() => this.toolbar().filterButton()) }],
 *       { onEnd: () => this.saveTourCompleted() },
 *     );
 *   }
 * }
 * ```
 */
@Injectable()
export class CoachmarkTourService {
  private allSteps: readonly CoachmarkStep[] = [];
  private options: CoachmarkTourOptions = {};

  private readonly steps = signal<readonly CoachmarkStep[]>([]);
  private readonly index = signal(-1);

  readonly activeStep = computed(() => this.steps()[this.index()]);
  readonly running = computed(() => this.activeStep() !== undefined);
  /** 1-based; 0 while the tour isn't running. */
  readonly stepNumber = computed(() => this.index() + 1);
  readonly totalSteps = computed(() => this.steps().length);

  /** Sets the tour's steps. Call before `start()`. */
  configure(steps: readonly CoachmarkStep[], options: CoachmarkTourOptions = {}): void {
    this.allSteps = steps;
    this.options = options;
  }

  isActive(id: string): boolean {
    return this.activeStep()?.id === id;
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
