import {
  Component,
  computed,
  DestroyRef,
  inject,
  ChangeDetectionStrategy,
  signal,
  input,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { combineLatest, debounceTime, finalize } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  LinkModule,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { ReportLoadingComponent } from "../../shared/report-loading.component";
import {
  ApplicationsTableV2Component,
  ApplicationTableRowV2,
} from "../shared/applications-table-v2/applications-table-v2.component";

/**
 * Displays all applications with at-risk password counts, member counts, and
 * checkbox selection for bulk mark-as-critical.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-all-applications-tab",
  standalone: true,
  templateUrl: "./all-applications-tab.component.html",
  imports: [
    ReportLoadingComponent,
    LinkModule,
    SearchModule,
    PipesModule,
    NoItemsModule,
    SharedModule,
    ApplicationsTableV2Component,
    TypographyModule,
  ],
})
export class AllApplicationsTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly accessIntelligenceService = inject(AccessIntelligenceDataService);
  private readonly drawerStateService = inject(DrawerStateService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  readonly organizationId = input.required<OrganizationId>();

  protected readonly noItemsIcon = Security;
  protected readonly dataSource = new TableDataSource<ApplicationTableRowV2>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  protected readonly selectedUrls = signal(new Set<string>());
  protected readonly markingAsCritical = signal(false);

  protected readonly report = toSignal(this.accessIntelligenceService.report$, {
    equal: () => false,
  });
  protected readonly loading = toSignal(this.accessIntelligenceService.loading$, {
    initialValue: false,
  });
  protected readonly ciphers = toSignal(this.accessIntelligenceService.ciphers$, {
    initialValue: [],
  });

  protected readonly drawerState = this.drawerStateService.drawerState;

  protected readonly applicationSummary = computed(() => this.report()?.summary ?? null);

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));

    combineLatest([this.accessIntelligenceService.report$, this.accessIntelligenceService.ciphers$])
      .pipe(takeUntilDestroyed())
      .subscribe(([report, ciphers]) => {
        if (!report) {
          this.dataSource.data = [];
          return;
        }

        const appMetadataMap = new Map(
          report.applications.map((app) => [app.applicationName, app]),
        );

        const tableData: ApplicationTableRowV2[] = report.reports.map((reportData) => {
          const metadata = appMetadataMap.get(reportData.applicationName);
          const iconCipherId = reportData.getIconCipherId();
          const iconCipher = iconCipherId ? ciphers.find((c) => c.id === iconCipherId) : undefined;

          return {
            applicationName: reportData.applicationName,
            passwordCount: reportData.passwordCount,
            atRiskPasswordCount: reportData.atRiskPasswordCount,
            memberCount: reportData.memberCount,
            atRiskMemberCount: reportData.atRiskMemberCount,
            isMarkedAsCritical: metadata?.isCritical ?? false,
            iconCipher,
          };
        });

        this.dataSource.data = tableData;
      });
  }

  protected markAppsAsCritical(): void {
    this.markingAsCritical.set(true);
    const count = this.selectedUrls().size;
    const appNames = Array.from(this.selectedUrls());

    this.accessIntelligenceService
      .markApplicationsAsCritical$(appNames)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.markingAsCritical.set(false)),
      )
      .subscribe({
        next: () => {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("criticalApplicationsMarkedSuccess", count.toString()),
          });
          this.selectedUrls.set(new Set<string>());
        },
        error: () => {
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("applicationsMarkedAsCriticalFail"),
          });
        },
      });
  }

  protected openOrgAtRiskMembersDrawer(): void {
    this.drawerStateService.openDrawer(DrawerType.OrgAtRiskMembers, "allAppsOrgAtRiskMembers");
  }

  protected openOrgAtRiskAppsDrawer(): void {
    this.drawerStateService.openDrawer(DrawerType.OrgAtRiskApps, "allAppsOrgAtRiskApplications");
  }

  readonly showAppAtRiskMembers = (applicationName: string): void => {
    this.drawerStateService.openDrawer(DrawerType.AppAtRiskMembers, applicationName);
  };

  readonly onCheckboxChange = ({
    applicationName,
    checked,
  }: {
    applicationName: string;
    checked: boolean;
  }): void => {
    this.selectedUrls.update((selectedUrls) => {
      const nextSelected = new Set(selectedUrls);
      if (checked) {
        nextSelected.add(applicationName);
      } else {
        nextSelected.delete(applicationName);
      }
      return nextSelected;
    });
  };

  readonly onSelectAllChange = (checked: boolean): void => {
    const filteredData = this.dataSource.filteredData;
    if (!filteredData) {
      return;
    }
    this.selectedUrls.update((selectedUrls) => {
      const nextSelected = new Set(selectedUrls);
      filteredData.forEach((row) =>
        checked ? nextSelected.add(row.applicationName) : nextSelected.delete(row.applicationName),
      );
      return nextSelected;
    });
  };
}
