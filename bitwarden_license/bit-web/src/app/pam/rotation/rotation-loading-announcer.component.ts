import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

/** The screen-reader half of a skeleton loading state. */
@Component({
  selector: "pam-rotation-loading-announcer",
  templateUrl: "./rotation-loading-announcer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe],
})
export class RotationLoadingAnnouncerComponent {
  /** Whether the surface's placeholder is on screen. */
  readonly loading = input.required<boolean>();

  /** i18n key naming what has arrived, announced once the load finishes. */
  readonly loadedKey = input.required<string>();

  /** Whether the load failed. */
  readonly failed = input(false);

  /** Latches once a load has been announced, so arrival is only announced after a departure. */
  private readonly announced = linkedSignal<boolean, boolean>({
    source: this.loading,
    computation: (loading, previous) => loading || (previous?.value ?? false),
  });

  /** Reads the latch before anything can short-circuit past it. */
  protected readonly message = computed(() => {
    const announced = this.announced();

    if (this.loading()) {
      return "loading";
    }

    return announced && !this.failed() ? this.loadedKey() : null;
  });
}
