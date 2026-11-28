import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
} from "@angular/core";

import { ProgressBarComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** Where the indicator starts, so a fast scan still shows a filled bar rather than an empty track. */
const START = 10;
const TICK_MS = 100;
/** The indicator eases toward this and waits there; the view is replaced on completion. */
const CEILING = 90;
const EASING = 0.06;

/**
 * The Health tab's progress view while the scan runs. The scan reports no progress events, so the
 * bar is animated (see PM-39223) and `ariaValueText` announces status instead of a fake number.
 */
@Component({
  selector: "dirt-health-scanning",
  templateUrl: "./health-scanning.component.html",
  imports: [ProgressBarComponent, TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthScanningComponent {
  protected readonly progress = signal(START);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The buttons that start a scan are destroyed when this view replaces them, dropping focus to
    // the body. Restore it to the heading, but never pull it from another control.
    afterNextRender(() => {
      const active = document.activeElement;
      if (active == null || active === document.body) {
        this.host.nativeElement.querySelector<HTMLElement>("h2")?.focus();
      }
    });

    const tick = setInterval(
      () => this.progress.update((v) => v + (CEILING - v) * EASING),
      TICK_MS,
    );
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}
