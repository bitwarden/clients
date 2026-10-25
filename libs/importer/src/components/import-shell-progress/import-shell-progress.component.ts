import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { catchError, distinctUntilChanged, filter, map, of, skip, startWith } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ProgressBarComponent, ScrollLayoutService, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportDestinationKind, ImportDestinations } from "../../models";
import { ImportDestinationServiceAbstraction } from "../../services";
import { IMPORT_DESTINATION_ROUTE_PATH } from "../import-destination/import-destination-route";

type ImportStep = 1 | 2 | 3;

type DestinationsState = { resolved: boolean; value: ImportDestinations | undefined };

/**
 * The "Select source" / "Import data" / "Select vault" heading, progress bar, and step-count text
 * shared by every platform's import shell. Reads the active step from the nearest routed
 * ancestor's `ActivatedRoute` — must be declared directly in a shell component's own template (not
 * behind another `router-outlet`) so it inherits that shell's route via DI. The shell also
 * provides the `ImportDestinationServiceAbstraction` that decides between two and three steps.
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

  private readonly destinationService = inject(ImportDestinationServiceAbstraction);

  private readonly stepSnapshot = (): ImportStep => {
    const child = this.route.snapshot.firstChild;
    if (!child?.paramMap.has("importType")) {
      return 1;
    }
    return child.routeConfig?.path === IMPORT_DESTINATION_ROUTE_PATH ? 3 : 2;
  };

  // initialValue: construction can happen before this navigation's own NavigationEnd fires.
  protected readonly currentStep = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.stepSnapshot()),
    ),
    { initialValue: this.stepSnapshot() },
  );

  // A failed lookup leaves `value` unset: the bar keeps two steps, and credential parsing's
  // Continue fails closed on the same lookup.
  private readonly destinations = toSignal(
    this.destinationService.destinations$.pipe(
      map((value): DestinationsState => ({ resolved: true, value })),
      catchError(() => of<DestinationsState>({ resolved: true, value: undefined })),
    ),
    { initialValue: { resolved: false, value: undefined } as DestinationsState },
  );

  // Hides the count rather than flashing "of 2" and then "of 3". The location page only exists
  // when the user has somewhere to choose.
  private readonly countPending = computed(
    () => this.currentStep() !== 3 && !this.destinations().resolved,
  );

  protected readonly totalSteps = computed(() =>
    this.currentStep() === 3 || this.destinations().value?.hasStep ? 3 : 2,
  );

  // "Location" wording whenever a My items card is offered (criteria 6442:149415).
  private readonly destinationHeadingKey = computed(() =>
    this.destinations().value?.options.some((o) => o.kind === ImportDestinationKind.MyItems)
      ? "selectLocation"
      : "selectVault",
  );

  protected readonly headingKey = computed(() => {
    switch (this.currentStep()) {
      case 1:
        return "importSourceBreadcrumb";
      case 2:
        return "importData";
      case 3:
        return this.destinationHeadingKey();
    }
  });
  protected readonly progressValue = computed(() =>
    this.countPending() ? 0 : (this.currentStep() / this.totalSteps()) * 100,
  );
  protected readonly stepText = computed(() =>
    this.countPending()
      ? ""
      : this.i18nService.t("importSourceStepCount", this.currentStep(), this.totalSteps()),
  );

  constructor() {
    // Announced unconditionally on construction so arrival is never silent, regardless of entry
    // timing relative to NavigationEnd.
    const announce = (): void =>
      void this.liveAnnouncer.announce(
        [this.i18nService.t(this.headingKey()), this.stepText()].filter(Boolean).join(", "),
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
