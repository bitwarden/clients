import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ProgressBarComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

@Component({
  templateUrl: "import-shell-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderModule, ProgressBarComponent, TypographyModule, I18nPipe, RouterOutlet],
})
export class ImportShellWebComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);

  private readonly isStepTwoSnapshot = (): boolean =>
    this.route.snapshot.firstChild?.routeConfig?.path === ":importType";

  // initialValue, not just the router.events stream: the Shell's own child component is
  // constructed during route activation, which happens before NavigationEnd fires for that same
  // navigation — without this, the Shell would render with no step info until the event arrives.
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
}
