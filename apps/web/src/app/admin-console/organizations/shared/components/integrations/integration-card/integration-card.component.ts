// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { Observable, Subject, combineLatest, takeUntil } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { SharedModule } from "../../../../../../shared/shared.module";

@Component({
  selector: "app-integration-card",
  templateUrl: "./integration-card.component.html",
  imports: [SharedModule],
})
export class IntegrationCardComponent implements AfterViewInit, OnDestroy {
  private destroyed$: Subject<void> = new Subject();
  @ViewChild("imageEle") imageEle: ElementRef<HTMLImageElement>;

  @Input() name: string;
  @Input() image: string;
  @Input() imageDarkMode?: string;
  @Input() linkURL: string;

  /** Adds relevant `rel` attribute to external links */
  @Input() externalURL?: boolean;

  /**
   * Date of when the new badge should be hidden.
   * When omitted, the new badge is never shown.
   *
   * @example "2024-12-31"
   */
  @Input() newBadgeExpiration?: string;
  @Input() description?: string;
  @Input() isConnected?: boolean;
  @Input() canSetupConnection?: boolean;

  constructor(
    private themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE)
    private systemTheme$: Observable<ThemeType>,
  ) {}

  ngAfterViewInit() {
    combineLatest([this.themeStateService.selectedTheme$, this.systemTheme$])
      .pipe(takeUntil(this.destroyed$))
      .subscribe(([theme, systemTheme]) => {
        // When the card doesn't have a dark mode image, exit early
        if (!this.imageDarkMode) {
          return;
        }

        if (theme === ThemeType.System) {
          // When the user's preference is the system theme,
          // use the system theme to determine the image
          const prefersDarkMode = systemTheme === ThemeType.Dark;

          this.imageEle.nativeElement.src = prefersDarkMode ? this.imageDarkMode : this.image;
        } else if (theme === ThemeType.Dark) {
          // When the user's preference is dark mode, use the dark mode image
          this.imageEle.nativeElement.src = this.imageDarkMode;
        } else {
          // Otherwise use the light mode image
          this.imageEle.nativeElement.src = this.image;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /** Show the "new" badge when expiration is in the future */
  showNewBadge() {
    if (!this.newBadgeExpiration) {
      return false;
    }

    const expirationDate = new Date(this.newBadgeExpiration);

    // Do not show the new badge for invalid dates
    if (isNaN(expirationDate.getTime())) {
      return false;
    }

    return expirationDate > new Date();
  }

  showConnectedBadge(): boolean {
    return this.isConnected !== undefined;
  }

  setupConnection(app: string) {
    // This method can be used to handle the connection logic for the integration
    // For example, it could open a modal or redirect to a setup page
    this.isConnected = !this.isConnected; // Toggle connection state for demonstration
  }
}
