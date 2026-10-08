import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from "@angular/core";

import { ReportBreach } from "@bitwarden/assets/svg";
import { ButtonModule, StatusLockupComponent, SvgComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Replaces a rotation tab's empty state or a detail page's content when its load fails. The
 * parent re-runs the loads on {@link retry}.
 */
@Component({
  selector: "pam-rotation-load-error",
  templateUrl: "./rotation-load-error.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, StatusLockupComponent, SvgComponent, I18nPipe],
  host: {
    class: "tw-block",
    role: "alert",
  },
})
export class RotationLoadErrorComponent implements AfterViewInit {
  readonly retry = output<void>();

  /** Whether this state answers a retry rather than the first read. */
  readonly focusRetry = input(false);

  protected readonly icon = ReportBreach;

  private readonly retryButton = viewChild<unknown, ElementRef<HTMLButtonElement>>("retryButton", {
    read: ElementRef,
  });

  ngAfterViewInit(): void {
    if (this.focusRetry()) {
      this.retryButton()?.nativeElement.focus();
    }
  }
}
