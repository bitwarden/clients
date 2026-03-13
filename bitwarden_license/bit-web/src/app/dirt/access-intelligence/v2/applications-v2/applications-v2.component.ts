import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed,
  input,
  DestroyRef,
} from "@angular/core";
import { toSignal, toObservable, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { combineLatest, debounceTime, finalize, startWith, take } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  IconButtonModule,
  LinkModule,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
  TooltipDirective,
  TypographyModule,
  ChipSelectComponent,
  IconComponent,
} from "@bitwarden/components";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { exportToCSV } from "@bitwarden/web-vault/app/dirt/reports/report-utils";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ReportLoadingComponent } from "../../shared/report-loading.component";
import { SecurityTasksService } from "../services/abstractions/security-tasks.service";
import {
  ApplicationsTableV2Component,
  ApplicationTableRowV2,
} from "../shared/applications-table-v2/applications-table-v2.component";

export const ApplicationFilterOption = {
  All: "all",
  Critical: "critical",
  NonCritical: "nonCritical",
} as const;

export type ApplicationFilterOption =
  (typeof ApplicationFilterOption)[keyof typeof ApplicationFilterOption];

/**
 * ApplicationsV2Component - Applications table for Access Intelligence V2 architecture
 *
 * Displays all applications with health metrics, critical status, and member access.
 * Uses AccessIntelligenceDataService for reactive data updates.
 *
 * Key V2 patterns:
 * - Uses toSignal() to convert service observables to signals
 * - All state management via signals (no manual subscriptions)
 * - Integrates with DrawerStateService for member details drawer
 */
@Component({
  selector: "app-applications-v2",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./applications-v2.component.html",
  imports: [
    ReportLoadingComponent,
    LinkModule,
    SearchModule,
    NoItemsModule,
    SharedModule,
    ApplicationsTableV2Component,
    IconButtonModule,
    TypographyModule,
    ButtonModule,
    ReactiveFormsModule,
    ChipSelectComponent,
    IconComponent,
    TooltipDirective,
  ],
})
export class ApplicationsV2Component {
  // Services
  private destroyRef = inject(DestroyRef);
  private fileDownloadService = inject(FileDownloadService);
  private logService = inject(LogService);
  private accessIntelligenceService = inject(AccessIntelligenceDataService);
  private drawerStateService = inject(DrawerStateService);
  private securityTasksService = inject(SecurityTasksService);
  private i18nService = inject(I18nService);
  private toastService = inject(ToastService);

  // Inputs
  readonly organizationId = input.required<OrganizationId>();

  // Icons
  protected noItemsIcon = Security;

  // Table data source (V2 uses ApplicationTableRowV2)
  protected readonly dataSource = new TableDataSource<ApplicationTableRowV2>();
  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });

  // Convert service observables to signals
  protected readonly report = toSignal(this.accessIntelligenceService.report$, {
    equal: () => false,
  });
  protected readonly loading = toSignal(this.accessIntelligenceService.loading$);
  protected readonly ciphers = toSignal(this.accessIntelligenceService.ciphers$, {
    initialValue: [],
  });

  // Local state signals
  protected readonly selectedUrls = signal(new Set<string>());
  protected readonly updatingCriticalApps = signal(false);
  protected readonly selectedFilter = signal<ApplicationFilterOption>(ApplicationFilterOption.All);
  protected readonly emptyTableExplanation = signal("");

  // Computed properties
  protected readonly criticalApplicationsCount = computed(() => {
    const report = this.report();
    return report?.getCriticalApplications().length ?? 0;
  });

  protected readonly totalApplicationsCount = computed(() => {
    const report = this.report();
    return report?.reports.length ?? 0;
  });

  protected readonly nonCriticalApplicationsCount = computed(() => {
    return this.totalApplicationsCount() - this.criticalApplicationsCount();
  });

  protected readonly filterOptions = computed(() => [
    {
      label: this.i18nService.t("critical", this.criticalApplicationsCount()),
      value: ApplicationFilterOption.Critical,
      icon: " ",
    },
    {
      label: this.i18nService.t("notCritical", this.nonCriticalApplicationsCount()),
      value: ApplicationFilterOption.NonCritical,
      icon: " ",
    },
  ]);

  protected readonly allSelectedAppsAreCritical = computed(() => {
    if (!this.dataSource.filteredData || this.selectedUrls().size === 0) {
      return false;
    }

    return this.dataSource.filteredData
      .filter((row) => this.selectedUrls().has(row.applicationName))
      .every((row) => row.isMarkedAsCritical);
  });

  protected readonly unassignedCipherIds = toSignal(
    this.securityTasksService.unassignedCriticalCipherIds$,
    { initialValue: [] },
  );

  protected readonly enableRequestPasswordChange = computed(
    () => this.unassignedCipherIds().length > 0,
  );

  // Drawer state for highlighting open application (already a Signal)
  protected readonly drawerState = this.drawerStateService.drawerState;

  constructor() {
    // Setup reactive data pipeline
    this.setupReportDataSubscription();
    this.setupSearchAndFilterSubscription();
  }

  /**
   * Sets up reactive subscription to report data.
   * Updates table data source when report changes.
   * Joins ApplicationHealthView (health data) with AccessReportSettingsView (metadata).
   */
  private setupReportDataSubscription(): void {
    // Update data source when report changes
    combineLatest([this.accessIntelligenceService.report$, this.accessIntelligenceService.ciphers$])
      .pipe(takeUntilDestroyed())
      .subscribe(([report, ciphers]) => {
        if (!report) {
          this.dataSource.data = [];
          return;
        }

        // Create a map of application metadata for quick lookup
        const appMetadataMap = new Map(
          report.applications.map((app) => [app.applicationName, app]),
        );

        // Join reports (health data) with applications (metadata) to create V2 table rows
        const tableData: ApplicationTableRowV2[] = report.reports.map((reportData) => {
          const metadata = appMetadataMap.get(reportData.applicationName);

          // Use pre-computed icon cipher ID from report (set during generation)
          const iconCipherId = reportData.getIconCipherId();
          const iconCipher = iconCipherId ? ciphers.find((c) => c.id === iconCipherId) : undefined;

          return {
            applicationName: reportData.applicationName,
            atRiskPasswordCount: reportData.atRiskPasswordCount,
            passwordCount: reportData.passwordCount,
            atRiskMemberCount: reportData.atRiskMemberCount,
            memberCount: reportData.memberCount,
            isMarkedAsCritical: metadata?.isCritical ?? false,
            iconCipher,
          };
        });

        this.dataSource.data = tableData;
      });
  }

  /**
   * Sets up reactive search and filter subscription.
   * Updates table filter when search text or filter selection changes.
   */
  private setupSearchAndFilterSubscription(): void {
    combineLatest([
      this.searchControl.valueChanges.pipe(startWith("")),
      toObservable(this.selectedFilter),
    ])
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe(([searchText, selectedFilter]) => {
        let filterFunction = (app: ApplicationTableRowV2) => true;

        if (selectedFilter === ApplicationFilterOption.Critical) {
          filterFunction = (app) => app.isMarkedAsCritical;
        } else if (selectedFilter === ApplicationFilterOption.NonCritical) {
          filterFunction = (app) => !app.isMarkedAsCritical;
        }

        this.dataSource.filter = (app) =>
          filterFunction(app) &&
          app.applicationName.toLowerCase().includes(searchText.toLowerCase());

        // Filter selectedUrls down to only applications showing with active filters
        const filteredUrls = new Set<string>();
        this.dataSource.filteredData?.forEach((row) => {
          if (this.selectedUrls().has(row.applicationName)) {
            filteredUrls.add(row.applicationName);
          }
        });
        this.selectedUrls.set(filteredUrls);

        if (this.dataSource?.filteredData?.length === 0) {
          this.emptyTableExplanation.set(this.i18nService.t("noApplicationsMatchTheseFilters"));
        } else {
          this.emptyTableExplanation.set("");
        }
      });
  }

  setFilterApplicationsByStatus(value: ApplicationFilterOption) {
    this.selectedFilter.set(value);
  }

  /**
   * Marks selected applications as critical in a single save operation.
   * Uses markApplicationsAsCritical$() to avoid multiple saves and UI flashing.
   */
  markAppsAsCritical(): void {
    this.updatingCriticalApps.set(true);
    const count = this.selectedUrls().size;
    const appNames = Array.from(this.selectedUrls());

    this.accessIntelligenceService
      .markApplicationsAsCritical$(appNames)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.updatingCriticalApps.set(false)),
      )
      .subscribe({
        next: () => {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("numCriticalApplicationsMarkedSuccess", count),
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

  /**
   * Unmarks selected applications as critical in a single save operation.
   * Uses unmarkApplicationsAsCritical$() to avoid multiple saves and UI flashing.
   */
  unmarkAppsAsCritical(): void {
    this.updatingCriticalApps.set(true);
    const appsToUnmark = this.selectedUrls();
    const appNames = Array.from(appsToUnmark);

    this.accessIntelligenceService
      .unmarkApplicationsAsCritical$(appNames)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.updatingCriticalApps.set(false)),
      )
      .subscribe({
        next: () => {
          this.toastService.showToast({
            message: this.i18nService.t(
              "numApplicationsUnmarkedCriticalSuccess",
              appsToUnmark.size,
            ),
            variant: "success",
          });
          this.selectedUrls.set(new Set<string>());
        },
        error: () => {
          this.toastService.showToast({
            message: this.i18nService.t("unexpectedError"),
            variant: "error",
            title: this.i18nService.t("error"),
          });
        },
      });
  }

  requestPasswordChange(): void {
    const orgId = this.organizationId();
    if (!orgId) {
      this.toastService.showToast({
        message: this.i18nService.t("unexpectedError"),
        variant: "error",
        title: this.i18nService.t("error"),
      });
      return;
    }

    this.securityTasksService
      .requestPasswordChangeForCriticalApplications$(orgId, this.unassignedCipherIds())
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            message: this.i18nService.t("notifiedMembers"),
            variant: "success",
            title: this.i18nService.t("success"),
          });
        },
        error: () => {
          this.toastService.showToast({
            message: this.i18nService.t("unexpectedError"),
            variant: "error",
            title: this.i18nService.t("error"),
          });
        },
      });
  }

  /**
   * Opens drawer to show at-risk members for a specific application.
   * Uses DrawerStateService to manage drawer state.
   */
  showAppAtRiskMembers = async (applicationName: string) => {
    this.drawerStateService.openDrawer(DrawerType.AppAtRiskMembers, applicationName);
  };

  onCheckboxChange = ({
    applicationName,
    checked,
  }: {
    applicationName: string;
    checked: boolean;
  }) => {
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

  onSelectAllChange = (checked: boolean) => {
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

  downloadApplicationsCSV(): void {
    try {
      const data = this.dataSource.filteredData;
      if (!data || data.length === 0) {
        return;
      }

      const exportData = data.map((app) => ({
        applicationName: app.applicationName,
        atRiskPasswordCount: app.atRiskPasswordCount,
        passwordCount: app.passwordCount,
        atRiskMemberCount: app.atRiskMemberCount,
        memberCount: app.memberCount,
        isMarkedAsCritical: app.isMarkedAsCritical
          ? this.i18nService.t("yes")
          : this.i18nService.t("no"),
      }));

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("applications"),
        blobData: exportToCSV(exportData, {
          applicationName: this.i18nService.t("application"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
          passwordCount: this.i18nService.t("totalPasswords"),
          atRiskMemberCount: this.i18nService.t("atRiskMembers"),
          memberCount: this.i18nService.t("totalMembers"),
          isMarkedAsCritical: this.i18nService.t("criticalBadge"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      this.logService.error("Failed to download applications CSV", error);
    }
  }
}
