import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { filter, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import type { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import {
  CalloutModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  TableModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import {
  AccessCondition,
  formatCondition,
  OrganizationGovernanceSummaryResponse,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { KillSwitchComponent } from "./kill-switch/kill-switch.component";

/**
 * Query-param convention for governance dashboard click-throughs (PM-37277).
 *
 * Filters preserved by linking from a governance row keep the user's context
 * when they jump into Members / Requests / Leases lists. Listing pages should
 * read this key and apply it as a collection filter.
 */
export const PAM_COLLECTION_FILTER_QUERY_PARAM = "collectionId";

type DashboardStatus = "loading" | "ready" | "empty" | "error";

/** A governance table row with its access-rule summary string precomputed. */
type GovernanceRow = {
  collectionId: string;
  collectionName: string;
  memberWithAccessCount: number;
  pendingRequestCount: number;
  activeLeaseCount: number;
  lastActivityAt: string | null;
  rule: string;
};

/**
 * Governance dashboard for PAM credential leasing (PM-37277).
 *
 * Satisfies requirement N6: one row per leasing-enabled collection summarizing
 * access rule, members requiring a lease, pending requests, active leases, and most
 * recent activity. Org-admin only — guarded by the route.
 *
 * Click-throughs preserve a `collectionId` query parameter so the destination
 * page (members / requests / leases) can pre-filter to the row's collection.
 */
@Component({
  selector: "app-pam-governance-dashboard",
  templateUrl: "./governance-dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    CalloutModule,
    SectionComponent,
    SectionHeaderComponent,
    TableModule,
    TooltipDirective,
    TypographyModule,
    LinkModule,
    I18nPipe,
    KillSwitchComponent,
  ],
})
export class GovernanceDashboardComponent implements OnInit {
  /**
   * Optional summary injected by Storybook / tests instead of fetching from
   * the API. When provided, the component skips the network call entirely.
   */
  readonly summaryOverride = input<OrganizationGovernanceSummaryResponse | null>(null);

  /** Optional org name for Storybook / tests. When provided, the component skips the org-service lookup. */
  readonly organizationNameOverride = input<string | null>(null);

  private readonly route = inject(ActivatedRoute);
  private readonly pamApiService = inject(PamApiService);
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<DashboardStatus>("loading");
  protected readonly summary = signal<OrganizationGovernanceSummaryResponse | null>(null);
  protected readonly organizationId = signal<string | null>(null);
  protected readonly organizationName = signal<string | null>(null);

  protected readonly rows = computed<GovernanceRow[]>(() =>
    (this.summary()?.collections ?? []).map((row) => ({
      collectionId: row.collectionId,
      collectionName: row.collectionName,
      memberWithAccessCount: row.memberWithAccessCount,
      pendingRequestCount: row.pendingRequestCount,
      activeLeaseCount: row.activeLeaseCount,
      lastActivityAt: row.lastActivityAt,
      rule: this.renderRule(row.conditions),
    })),
  );
  protected readonly collectionTotal = computed(
    () => this.summary()?.leasingEnabledCollectionCount ?? 0,
  );
  protected readonly pendingTotal = computed(() => this.summary()?.totalPendingRequestCount ?? 0);
  protected readonly activeTotal = computed(() => this.summary()?.totalActiveLeaseCount ?? 0);

  // Sibling route paths under `/organizations/{id}/`.
  // Use `../` to leave the `pam/` segment without depending on the parent
  // organizationId param resolving inside the click handler.
  protected readonly membersUrl = ["..", "..", "members"];
  protected readonly pendingUrl = ["..", "..", "pam", "requests"];
  protected readonly activeUrl = ["..", "..", "pam", "leases"];

  async ngOnInit(): Promise<void> {
    const override = this.summaryOverride();
    if (override != null) {
      this.summary.set(override);
      this.status.set(override.collections.length === 0 ? "empty" : "ready");
      if (this.organizationNameOverride() != null) {
        this.organizationName.set(this.organizationNameOverride());
      }
      return;
    }

    const organizationId = this.route.snapshot.paramMap.get("organizationId");
    if (organizationId == null) {
      this.status.set("error");
      return;
    }

    this.organizationId.set(organizationId);

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.organizationService.organizations$(userId).pipe(getById(organizationId)),
        ),
        filter((org): org is Organization => org != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((org) => this.organizationName.set(org.name));

    try {
      const summary = await this.pamApiService.getGovernanceSummary(organizationId);
      this.summary.set(summary);
      this.status.set(summary.collections.length === 0 ? "empty" : "ready");
    } catch (e) {
      this.logService.error(e);
      this.status.set("error");
    }
  }

  protected collectionQuery(collectionId: string): Record<string, string> {
    return { [PAM_COLLECTION_FILTER_QUERY_PARAM]: collectionId };
  }

  /** Render a row's conditions as a single human-readable string. */
  private renderRule(conditions: AccessCondition[]): string {
    if (conditions.length === 0) {
      return this.i18nService.t("pamAccessRuleNone");
    }
    const separator = this.i18nService.t("pamAccessRuleSeparator");
    return conditions
      .map((c) => {
        const summary = formatCondition(c);
        return summary.params?.count != null
          ? this.i18nService.t(summary.key, String(summary.params.count))
          : this.i18nService.t(summary.key);
      })
      .join(separator);
  }
}
