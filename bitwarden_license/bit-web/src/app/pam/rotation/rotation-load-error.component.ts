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
 * Shown by a rotation tab when its list could not be fetched, in place of the tab's empty state.
 * Emits {@link retry}; the parent owns re-running whichever loads that tab needs.
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

  /**
   * Whether this state is the answer to a retry rather than the first read.
   */
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
