import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { distinctUntilChanged, filter, map, skip, startWith } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ProgressBarComponent, ScrollLayoutService, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The "Select source" / "Import data" heading, progress bar, and step-count text shared by every
 * platform's import shell. Reads the active step from the nearest routed ancestor's
 * `ActivatedRoute` — must be declared directly in a shell component's own template (not behind
 * another `router-outlet`) so it inherits that shell's route via DI.
 */
@Component({
  selector: "importer-shell-progress",
  templateUrl: "./import-shell-progress.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressBarComponent, TypographyModule, I18nPipe],
})
export class ImportShellProgressComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly scrollLayout = inject(ScrollLayoutService);

  private readonly isStepTwoSnapshot = (): boolean =>
    this.route.snapshot.firstChild?.paramMap.has("importType") ?? false;

  // initialValue: construction can happen before this navigation's own NavigationEnd fires.
  protected readonly isStepTwo = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.isStepTwoSnapshot()),
    ),
    { initialValue: this.isStepTwoSnapshot() },
  );

  protected readonly currentStep = computed(() => (this.isStepTwo() ? 2 : 1));
  protected readonly totalSteps = 2;

  protected readonly headingKey = computed(() =>
    this.isStepTwo() ? "importData" : "importSourceBreadcrumb",
  );
  protected readonly progressValue = computed(() => (this.currentStep() / this.totalSteps) * 100);
  protected readonly stepText = computed(() =>
    this.i18nService.t("importSourceStepCount", this.currentStep(), this.totalSteps),
  );

  constructor() {
    // Announced unconditionally on construction so arrival is never silent, regardless of entry
    // timing relative to NavigationEnd.
    const announce = (): void =>
      void this.liveAnnouncer.announce(
        `${this.i18nService.t(this.headingKey())}, ${this.stepText()}`,
        "polite",
      );
    announce();

    // Seeded with the current URL so the first real NavigationEnd (this navigation's own) is
    // deduped as a repeat of the arrival just announced above; skip(1) drops that seed itself.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map((event) => event.urlAfterRedirects),
        startWith(this.router.url),
        distinctUntilChanged(),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        announce();
        this.scrollLayout.scrollableRef()?.nativeElement.scrollTo({ top: 0, behavior: "instant" });
      });
  }
}
