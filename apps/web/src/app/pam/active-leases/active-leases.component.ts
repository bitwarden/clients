import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  InjectionToken,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { interval, startWith } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  NoItemsModule,
  TableModule,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { LeaseRevokeRequest, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { formatRemaining } from "../utils/format-remaining";

import {
  ActiveLeaseRow,
  idPassthroughResolver,
  LeaseDisplayResolver,
  toActiveLeaseRow,
} from "./active-lease-row";

/**
 * Injection token for the lease display resolver. Defaults to passing the
 * raw ID through; production wiring (cipher/collection/user name lookup)
 * lands in a follow-up story so multiple PAM views can share one resolver.
 */
export const ACTIVE_LEASE_DISPLAY_RESOLVER = new InjectionToken<LeaseDisplayResolver>(
  "ActiveLeaseDisplayResolver",
  { factory: () => idPassthroughResolver },
);

/**
 * Page listing in-flight `Lease` rows for collections the caller governs,
 * with a Revoke action per row. Gated by `FeatureFlag.Pam`.
 */
@Component({
  selector: "app-pam-active-leases",
  templateUrl: "./active-leases.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    I18nPipe,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    FormFieldModule,
    IconButtonModule,
    IconModule,
    NoItemsModule,
    TableModule,
    TooltipDirective,
    TypographyModule,
  ],
})
export class ActiveLeasesComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly configService = inject(ConfigService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly i18nService = inject(I18nService);
  private readonly resolver = inject(ACTIVE_LEASE_DISPLAY_RESOLVER);
  private readonly destroyRef = inject(DestroyRef);

  /** Reactive clock used for countdown labels — ticks once per second. */
  protected readonly now = signal<Date>(new Date());

  /** True until the first list fetch resolves (success or failure). */
  protected readonly loading = signal<boolean>(true);

  /** Surface fetch errors as a banner; user keeps the existing rows. */
  protected readonly loadError = signal<string | null>(null);

  /** Hydrated rows for the current caller. */
  protected readonly rows = signal<ActiveLeaseRow[]>([]);

  /** Row IDs currently in the inline-confirm state. */
  protected readonly confirmingIds = signal<ReadonlySet<string>>(new Set());

  /** Row IDs in flight on a revoke call — prevents double-submission. */
  protected readonly revokingIds = signal<ReadonlySet<string>>(new Set());

  /** Optional reason text per row, keyed by lease id. */
  protected readonly reasonControls = new Map<string, FormControl<string>>();

  protected readonly featureEnabled = signal<boolean>(false);

  protected readonly displayRows = computed(() => {
    // Hide rows that have been revoked and shown their "Revoked" badge for one tick.
    return this.rows().filter((row) => !row.justRevoked || this.isJustRevokedFresh(row));
  });

  ngOnInit(): void {
    this.configService
      .getFeatureFlag$(FeatureFlag.Pam)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => {
        this.featureEnabled.set(enabled === true);
        if (enabled) {
          void this.refresh();
        }
      });

    interval(1000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(new Date()));
  }

  protected readonly refresh = async (): Promise<void> => {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const leases = await this.pamApi.listActiveLeases();
      this.rows.set(leases.map((lease) => toActiveLeaseRow(lease, this.resolver)));
    } catch (error: unknown) {
      this.logService.error("[PAM] listActiveLeases failed", error);
      this.loadError.set("activeLeasesLoadFailed");
    } finally {
      this.loading.set(false);
    }
  };

  protected remainingLabel(row: ActiveLeaseRow): string {
    return formatRemaining(row.notAfter, this.now());
  }

  protected windowTooltip(row: ActiveLeaseRow): string {
    return `${row.notBefore.toISOString()} - ${row.notAfter.toISOString()}`;
  }

  protected isConfirming(id: string): boolean {
    return this.confirmingIds().has(id);
  }

  protected isRevoking(id: string): boolean {
    return this.revokingIds().has(id);
  }

  protected reasonControlFor(id: string): FormControl<string> {
    let control = this.reasonControls.get(id);
    if (!control) {
      control = new FormControl<string>("", { nonNullable: true });
      this.reasonControls.set(id, control);
    }
    return control;
  }

  protected startConfirm(id: string): void {
    const next = new Set(this.confirmingIds());
    next.add(id);
    this.confirmingIds.set(next);
  }

  protected cancelConfirm(id: string): void {
    const next = new Set(this.confirmingIds());
    next.delete(id);
    this.confirmingIds.set(next);
    this.reasonControls.delete(id);
  }

  protected readonly confirmRevoke = async (id: string): Promise<void> => {
    if (this.revokingIds().has(id)) {
      // Guard against double-submission via fast double-click or Enter spam.
      return;
    }

    const reason = this.reasonControls.get(id)?.value?.trim();
    const request = new LeaseRevokeRequest({ reason: reason ? reason : undefined });

    const next = new Set(this.revokingIds());
    next.add(id);
    this.revokingIds.set(next);

    let succeeded = false;
    try {
      await this.pamApi.revokeLease(id, request);
      succeeded = true;
      this.markRevoked(id);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("leaseRevoked"),
      });
    } catch (error: unknown) {
      this.logService.error("[PAM] revokeLease failed", error);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("leaseRevokeFailed"),
      });
      // UI restores: keep the row visible and the inline confirm open so the
      // caller can correct the reason and retry without re-clicking Revoke.
    } finally {
      const post = new Set(this.revokingIds());
      post.delete(id);
      this.revokingIds.set(post);
      if (succeeded) {
        // Close the confirm UI on success — the row is on its way out.
        this.cancelConfirm(id);
      }
    }
  };

  /**
   * Mark a row as just-revoked and schedule its removal on the next render.
   * The transient "Revoked" badge gives the caller visual confirmation
   * before the row disappears.
   */
  private markRevoked(id: string): void {
    const stamp = new Date();
    this.rows.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, justRevoked: true, revokedAt: stamp } : row)),
    );
    // Schedule a render that removes the row.
    setTimeout(() => {
      this.rows.update((rows) => rows.filter((row) => row.id !== id));
    }, 1500);
  }

  private isJustRevokedFresh(row: ActiveLeaseRow): boolean {
    if (!row.justRevoked || !row.revokedAt) {
      return false;
    }
    return this.now().getTime() - row.revokedAt.getTime() < 1500;
  }
}
