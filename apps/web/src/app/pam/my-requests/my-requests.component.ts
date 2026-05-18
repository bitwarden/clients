import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  ContainerComponent,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  LeaseRequestResponse,
  LeaseRequestStatus,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

/** Max items rendered per section in v0 (no pagination). */
export const MY_REQUESTS_PAGE_LIMIT = 50;

/** Recency window (in days) for the "Recent" section. */
export const RECENT_WINDOW_DAYS = 7;

/**
 * Cipher-name lookup is deferred — the v0 response only carries `cipherId`. Until
 * the cipher-fetch transport lands (PM-37264), rows surface the raw id so the page
 * is still useful for QA / smoke testing.
 */
export type MyRequestRow = {
  id: string;
  cipherId: string;
  cipherName: string | null;
  status: LeaseRequestStatus;
  submittedAt: Date;
  resolvedAt: Date | null;
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  resolverDisplayName: string | null;
  resolverComment: string | null;
};

/**
 * "My requests" page. Surfaces the caller's own LeaseRequests, split into:
 *  - Pending (status = pending)
 *  - Recent  (status ≠ pending AND resolvedAt within RECENT_WINDOW_DAYS)
 *
 * Capped at MY_REQUESTS_PAGE_LIMIT per section in v0; filtering, sorting, and
 * pagination are explicit non-goals.
 */
@Component({
  standalone: true,
  selector: "app-pam-my-requests",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./my-requests.component.html",
  imports: [
    CommonModule,
    ContainerComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    TableModule,
    BadgeComponent,
    ButtonModule,
    NoItemsModule,
    I18nPipe,
  ],
})
export class MyRequestsComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);

  protected readonly showPam = signal(false);
  protected readonly loading = signal(true);
  protected readonly cancelling = signal<Set<string>>(new Set<string>());

  private readonly rows = signal<MyRequestRow[]>([]);

  protected readonly pendingRows = computed(() =>
    this.rows()
      .filter((r) => r.status === "pending")
      .slice(0, MY_REQUESTS_PAGE_LIMIT),
  );

  protected readonly recentRows = computed(() => {
    const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return this.rows()
      .filter(
        (r) => r.status !== "pending" && r.resolvedAt != null && r.resolvedAt.getTime() >= cutoff,
      )
      .slice(0, MY_REQUESTS_PAGE_LIMIT);
  });

  protected readonly hasAnyRows = computed(
    () => this.pendingRows().length > 0 || this.recentRows().length > 0,
  );

  constructor() {
    this.configService
      .getFeatureFlag$(FeatureFlag.Pam)
      .pipe(takeUntilDestroyed())
      .subscribe((enabled) => this.showPam.set(enabled));
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const responses = await this.pamApi.listMyRequests();
      this.rows.set(responses.map((r) => toRow(r, this.i18nService)));
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsLoadError"),
      });
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected isCancelling(id: string): boolean {
    return this.cancelling().has(id);
  }

  protected async cancel(row: MyRequestRow): Promise<void> {
    if (row.status !== "pending" || this.isCancelling(row.id)) {
      return;
    }

    const next = new Set(this.cancelling());
    next.add(row.id);
    this.cancelling.set(next);

    // Optimistic update: flip status to "cancelled" and stamp resolvedAt.
    const previous = this.rows();
    const now = new Date();
    this.rows.set(
      previous.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: "cancelled" as LeaseRequestStatus,
              resolvedAt: now,
              resolverDisplayName: this.i18nService.t("pamResolverPolicy"),
            }
          : r,
      ),
    );

    try {
      await this.pamApi.cancelLeaseRequest(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamMyRequestsCancelSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.rows.set(previous);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsCancelError"),
      });
    } finally {
      const remaining = new Set(this.cancelling());
      remaining.delete(row.id);
      this.cancelling.set(remaining);
    }
  }

  protected statusVariant(status: LeaseRequestStatus): BadgeVariant {
    return statusBadgeVariant(status);
  }

  protected statusLabelKey(status: LeaseRequestStatus): string {
    return statusLabelKey(status);
  }
}

/** Map a status to a badge variant. Exported for tests + storybook fidelity. */
export function statusBadgeVariant(status: LeaseRequestStatus): BadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "denied":
      return "danger";
    case "cancelled":
      return "subtle";
    case "expired":
      return "warning";
    case "pending":
      return "primary";
  }
}

/** i18n key for a status label. Exported for tests. */
export function statusLabelKey(status: LeaseRequestStatus): string {
  switch (status) {
    case "approved":
      return "pamStatusApproved";
    case "denied":
      return "pamStatusDenied";
    case "cancelled":
      return "pamStatusCancelled";
    case "expired":
      return "pamStatusExpired";
    case "pending":
      return "pamStatusPending";
  }
}

/**
 * Build the resolver display label.
 *
 * The API surfaces `resolverUserId = null` for system / policy decisions and a
 * user id for human decisions. Mapping the id → display name needs another data
 * source we don't have wired up yet (PM-37267 follow-up). Until then, surface the
 * raw id as a fallback so the page is still functional.
 */
export function resolveResolverDisplayName(
  response: Pick<LeaseRequestResponse, "status" | "resolverUserId">,
  i18n: I18nService,
): string | null {
  if (response.status === "pending") {
    return null;
  }
  if (response.resolverUserId == null) {
    return i18n.t("pamResolverPolicy");
  }
  return response.resolverUserId;
}

function toRow(response: LeaseRequestResponse, i18n: I18nService): MyRequestRow {
  return {
    id: response.id,
    cipherId: response.cipherId,
    cipherName: null,
    status: response.status,
    submittedAt: new Date(response.submittedAt),
    resolvedAt: response.resolvedAt == null ? null : new Date(response.resolvedAt),
    requestedNotBefore:
      response.requestedNotBefore == null ? null : new Date(response.requestedNotBefore),
    requestedNotAfter:
      response.requestedNotAfter == null ? null : new Date(response.requestedNotAfter),
    requestedTtlSeconds: response.requestedTtlSeconds,
    resolverDisplayName: resolveResolverDisplayName(response, i18n),
    resolverComment: response.resolverComment,
  };
}
