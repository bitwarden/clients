import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  LOCALE_ID,
  signal,
  TrackByFunction,
  untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { AccountWarning, NoResults, RegistrationUserAddIcon } from "@bitwarden/assets/svg";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeComponent,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTablePaginatorComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  defineTable,
  FilterMenuModule,
  SearchModule,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { HeaderModule } from "../../../../../layouts/header/header.module";
import { MemberAdoptionTileComponent } from "../../../components/member-adoption-tile/member-adoption-tile.component";
import { exportToCSV } from "../../../report-utils";

import { MemberAdoptionReportBreadcrumbsComponent } from "./member-adoption-report-breadcrumbs.component";
import { MemberAdoptionReportApiService } from "./services/member-adoption-report-api.service";
import { MemberAdoptionReportServiceAbstraction } from "./services/member-adoption-report.abstraction";
import { MemberAdoptionReportService } from "./services/member-adoption-report.service";
import {
  memberAdoptionExportHeaders,
  MemberAdoptionMemberView,
  MemberAdoptionReportView,
} from "./view/member-adoption-report.view";

/** Column names do not map to row fields, so every column needs an explicit `sortFn`. */
const MEMBER_ADOPTION_COLUMNS = Object.freeze([
  "name",
  "recentLogin",
  "extensionInstalled",
  "vaultItems",
  "itemsSharedWithThem",
] as const);

export type MemberAdoptionTableColumn = (typeof MEMBER_ADOPTION_COLUMNS)[number];

/** A filter chip's value: string-valued so it survives the URL round trip, locale-independent. */
export type MemberAdoptionBooleanFilter = "yes" | "no";

export type MemberAdoptionTableFilters = {
  /** Reserved key — the table adopts the projected `bit-search` under it automatically. */
  search?: string;
  recentLogin?: MemberAdoptionBooleanFilter;
  extensionInstalled?: MemberAdoptionBooleanFilter;
};

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function matchesBoolean(value: boolean, filter: MemberAdoptionBooleanFilter | undefined): boolean {
  return filter == null || (filter === "yes") === value;
}

const EMPTY_STATES = Object.freeze({
  loadFailed: {
    titleKey: "memberAdoptionLoadError",
    descriptionKey: "memberAdoptionLoadErrorDesc",
    icon: AccountWarning,
  },
  noMatches: {
    titleKey: "noMatchingItems",
    descriptionKey: "clearFiltersOrTryAnother",
    icon: NoResults,
  },
  noMembers: {
    titleKey: "memberAdoptionNoMembers",
    descriptionKey: "memberAdoptionNoMembersDesc",
    icon: RegistrationUserAddIcon,
  },
} as const);

/**
 * Organization adoption: two headline tiles over a table of every confirmed member.
 *
 * The endpoint returns the whole member list, so search, sort, and pagination run client-side.
 */
@Component({
  selector: "dirt-member-adoption-report",
  templateUrl: "./member-adoption-report.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    BadgeComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTablePaginatorComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ButtonModule,
    FilterMenuModule,
    HeaderModule,
    I18nPipe,
    MemberAdoptionReportBreadcrumbsComponent,
    MemberAdoptionTileComponent,
    SearchModule,
    StatusLockupComponent,
    SvgComponent,
    TypographyModule,
  ],
  providers: [
    safeProvider({
      provide: MemberAdoptionReportServiceAbstraction,
      useClass: MemberAdoptionReportService,
      deps: [MemberAdoptionReportApiService, I18nService],
    }),
  ],
})
export class MemberAdoptionReportComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly reportService = inject(MemberAdoptionReportServiceAbstraction);
  private readonly fileDownloadService = inject(FileDownloadService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly toastService = inject(ToastService);

  private readonly locale = inject(LOCALE_ID);

  private readonly percentFormat = new Intl.NumberFormat(this.locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });

  private readonly countFormat = new Intl.NumberFormat(this.locale);

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((params) => params.organizationId as OrganizationId | undefined)),
  );

  private readonly report = signal<MemberAdoptionReportView | undefined>(undefined);

  protected readonly loading = signal(true);

  /** Whether the last load threw, so failed metrics read as missing rather than as 0%. */
  protected readonly loadFailed = signal(false);

  protected readonly members = computed<MemberAdoptionMemberView[]>(
    () => this.report()?.members ?? [],
  );

  protected readonly table = defineTable<MemberAdoptionMemberView, MemberAdoptionTableColumn>(
    this.members,
  );

  protected readonly trackByOrganizationUser: TrackByFunction<MemberAdoptionMemberView> = (
    _index,
    member,
  ) => member.organizationUserId;

  protected readonly pageSize = DEFAULT_PAGE_SIZE;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** Separates "filtered down to nothing" from "this organization has no members". */
  private readonly hasMembers = computed(() => this.members().length > 0);

  /** One `slot="empty"` for all three cases: projection matches static top-level nodes only. */
  protected readonly emptyState = computed(() => {
    if (this.loadFailed()) {
      return EMPTY_STATES.loadFailed;
    }
    return this.hasMembers() ? EMPTY_STATES.noMatches : EMPTY_STATES.noMembers;
  });

  protected readonly activeMemberCount = computed(() =>
    this.countFormat.format(this.report()?.activeMemberCount ?? 0),
  );

  /** The tile formats nothing of its own, so the count's unit is pluralised here. */
  protected readonly activeMemberUnitKey = computed(() =>
    (this.report()?.activeMemberCount ?? 0) === 1 ? "memberLower" : "membersLower",
  );

  protected readonly sponsoredFamiliesPercent = computed(() =>
    this.formatPercent(
      this.report()?.sponsoredFamiliesRedeemedCount ?? 0,
      this.report()?.totalMemberCount ?? 0,
    ),
  );

  protected formatCount(value: number): string {
    return this.countFormat.format(value);
  }

  protected displayName(member: MemberAdoptionMemberView): string {
    return member.name || member.email;
  }

  /** Empty when the member has no name: `displayName` already shows their email. */
  protected secondaryEmail(member: MemberAdoptionMemberView): string {
    return member.name ? member.email : "";
  }

  protected readonly sortByName: SortFn = (
    a: MemberAdoptionMemberView,
    b: MemberAdoptionMemberView,
  ) => this.displayName(a).localeCompare(this.displayName(b));

  protected readonly sortByRecentLogin: SortFn = (
    a: MemberAdoptionMemberView,
    b: MemberAdoptionMemberView,
  ) => Number(a.hasRecentLogin) - Number(b.hasRecentLogin);

  protected readonly sortByExtensionInstalled: SortFn = (
    a: MemberAdoptionMemberView,
    b: MemberAdoptionMemberView,
  ) => Number(a.hasExtensionInstalled) - Number(b.hasExtensionInstalled);

  protected readonly sortByVaultItems: SortFn = (
    a: MemberAdoptionMemberView,
    b: MemberAdoptionMemberView,
  ) => a.vaultItemCount - b.vaultItemCount;

  protected readonly sortBySharedItems: SortFn = (
    a: MemberAdoptionMemberView,
    b: MemberAdoptionMemberView,
  ) => a.sharedItemCount - b.sharedItemCount;

  protected readonly filter = (
    member: MemberAdoptionMemberView,
    values: MemberAdoptionTableFilters,
  ): boolean =>
    this.matchesSearch(member, values.search) &&
    matchesBoolean(member.hasRecentLogin, values.recentLogin) &&
    matchesBoolean(member.hasExtensionInstalled, values.extensionInstalled);

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();
      if (organizationId == null) {
        return;
      }
      // The load writes the signals this effect would otherwise re-read.
      untracked(() => {
        void this.load(organizationId);
      });
    });
  }

  protected readonly exportReport = async (): Promise<void> => {
    const organizationId = this.organizationId();
    if (organizationId == null) {
      return;
    }

    const exportItems = await this.reportService.getMemberAdoptionExportItems(organizationId);

    this.fileDownloadService.download({
      fileName: ExportHelper.getFileName("member-adoption"),
      blobData: exportToCSV(exportItems, memberAdoptionExportHeaders),
      blobOptions: { type: "text/plain" },
    });
  };

  protected readonly retryLoad = async (): Promise<void> => {
    const organizationId = this.organizationId();
    if (organizationId == null) {
      return;
    }

    await this.load(organizationId);
  };

  private async load(organizationId: OrganizationId): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      this.report.set(await this.reportService.getMemberAdoptionReport(organizationId));
    } catch (error: unknown) {
      // Ids only: no member data reaches the log.
      this.logService.error(
        `[MemberAdoptionReportComponent] Failed to load the member adoption report for organization ${organizationId}`,
        error,
      );
      this.report.set(undefined);
      this.loadFailed.set(true);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * A whole percent of `total`, in the user's locale. Never NaN, and never a clean 0% or 100%
   * while any member falls the other way.
   */
  private formatPercent(part: number, total: number): string {
    if (total <= 0) {
      return this.percentFormat.format(0);
    }

    const ratio = part / total;
    const rounded = Math.round(ratio * 100);

    if (rounded === 0 && part > 0) {
      return this.i18nService.t("lessThanPercent", this.percentFormat.format(0.01));
    }
    if (rounded === 100 && part < total) {
      return this.i18nService.t("moreThanPercent", this.percentFormat.format(0.99));
    }

    return this.percentFormat.format(ratio);
  }

  private matchesSearch(member: MemberAdoptionMemberView, search: string | undefined): boolean {
    const term = search?.trim().toLowerCase();
    if (!term) {
      return true;
    }
    return member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term);
  }
}
