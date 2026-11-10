import { computed, Injectable, signal } from "@angular/core";

/**
 * Provided by each nav group and nav section. Nested groups that render a leading collapse toggle
 * register here, so leaf siblings can reserve the toggle's width and keep their content aligned.
 */
@Injectable()
export class NavToggleScope {
  private readonly toggleCount = signal(0);

  readonly hasStartToggle = computed(() => this.toggleCount() > 0);

  /** Returns the callback that unregisters the toggle. */
  register(): () => void {
    this.toggleCount.update((count) => count + 1);
    return () => this.toggleCount.update((count) => count - 1);
  }
}
