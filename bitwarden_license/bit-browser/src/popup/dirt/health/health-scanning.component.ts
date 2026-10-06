import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";

import { ProgressBarComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** Where the indicator starts, so a fast scan still shows a filled bar rather than an empty track. */
const START = 10;
/** How often the indicator advances, in milliseconds. */
const TICK_MS = 100;
/** The indicator eases toward this and waits there; the view is replaced on completion. */
const CEILING = 90;
/** Fraction of the remaining distance covered each tick, so it decelerates. */
const EASING = 0.06;

/**
 * The Health tab's progress view, shown while the vault-health scan is running.
 * Presentational: the Health tab root owns the scan and decides when this is on
 * screen.
 *
 * The indicator is animated rather than driven by real progress. The scan is a
 * single await with no progress events to report, so there is nothing to bind a
 * percentage to — see PM-39223's plan for the alternatives considered. It eases
 * toward a ceiling and stays there; when the scan resolves the root swaps this
 * whole view out, so the bar is never seen to complete.
 *
 * Because the percentage is not real, it is kept away from assistive technology:
 * `ariaValueText` announces the status instead of a number.
 */
@Component({
  selector: "dirt-health-scanning",
  templateUrl: "./health-scanning.component.html",
  imports: [ProgressBarComponent, TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthScanningComponent {
  protected readonly progress = signal(START);

  constructor() {
    const tick = setInterval(
      () => this.progress.update((v) => v + (CEILING - v) * EASING),
      TICK_MS,
    );
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}
