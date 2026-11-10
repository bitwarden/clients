import { DestroyRef, Injectable, LOCALE_ID, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import {
  EMPTY,
  Observable,
  Subscription,
  combineLatest,
  concat,
  defer,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  takeWhile,
  tap,
} from "rxjs";

import {
  AccessBadgeState,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  type CipherAccessStateView,
  activateAccessErrorMessageKey,
  callerOrganizations$,
  cipherAccessBadgeState,
  formatRemaining,
  isUnlicensedError,
  unactivatedApprovedRequest,
  unlicensedForPam,
} from "@bitwarden/bit-pam";
import {
  AccessBadgeTickerService,
  ExtendLeaseDialogComponent,
} from "@bitwarden/bit-pam-components";
import { VaultRowSubtitle } from "@bitwarden/browser/vault/popup/components/vault/vault-row-slots/vault-row-subtitle.token";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";
import { VaultItemsTableRowAction } from "@bitwarden/vault";

import { VaultRowAccessStateService } from "../vault-row-access-state/vault-row-access-state.service";

import { VaultRowAccessStatus } from "./vault-row-access-status";

/** Separates the status from the username in a row's subtitle, as in "8h left • frodo@shire.com". */
const SUBTITLE_SEPARATOR = " • ";

/**
 * The status each popup vault row shows for a privileged-control item, off the SDK's badge
 * ranking, and the request, start, extend and end actions its overflow menu offers. Binds
 * `VAULT_ROW_SUBTITLE` and backs `VAULT_ROW_ICON` and `VAULT_ROW_ACTIONS`. Nothing is reported until
 * the member is known to be licensed.
 */
@Injectable()
export class BrowserVaultRowAccessService implements VaultRowSubtitle {
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly rowState = inject(VaultRowAccessStateService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessLeaseSdkService = inject(AccessLeaseSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly locale = inject(LOCALE_ID);
  private readonly revealedCipherService = inject(RevealedCipherService);

  private readonly organizations$ = callerOrganizations$(
    this.accountService,
    this.organizationService,
  );

  private readonly pamEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  /** The latest status each row reported, by cipher id, for the menu's synchronous checks. */
  private readonly statuses = signal<ReadonlyMap<string, VaultRowAccessStatus>>(new Map());

  /** Status reads the menu started for rows that render no icon or subtitle, by cipher id. */
  private readonly watched = new Map<string, Subscription>();

  constructor() {
    // The popup document survives an account switch, so the previous account's statuses go.
    this.accountService.activeAccount$
      .pipe(
        map((account) => account?.id ?? null),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.unwatchAll();
        this.statuses.set(new Map());
      });
    inject(DestroyRef).onDestroy(() => this.unwatchAll());
  }

  /**
   * A restricted item is always governed. An unrestricted one is governed only while a live
   * revealed copy exists, which is how a leased item that the list no longer marks restricted
   * still shows its countdown. Nothing else costs an access-state read.
   */
  status$(cipher: CipherViewLike): Observable<VaultRowAccessStatus | null> {
    const cipherId = cipher.id == null ? null : String(cipher.id);
    if (cipherId == null) {
      return of(null);
    }
    const restricted = CipherViewLikeUtils.isRestricted(cipher);
    const governed$ = restricted ? of(true) : this.isRevealed$(cipherId);
    const unlicensed$ =
      cipher.organizationId == null
        ? of(false)
        : this.organizations$.pipe(
            map((organizations) =>
              unlicensedForPam(organizations.find((o) => o.id === cipher.organizationId)),
            ),
          );
    return combineLatest([this.pamEnabled$, unlicensed$, governed$]).pipe(
      distinctUntilChanged(([a, b, c], [d, e, f]) => a === d && b === e && c === f),
      switchMap(([enabled, unlicensed, governed]) =>
        !enabled || unlicensed || !governed
          ? of(null)
          : this.rowState
              .state$(cipherId)
              .pipe(switchMap((state) => this.toStatus$(cipherId, state))),
      ),
      tap((status) => this.record(cipherId, status)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /** The status, then the revealed username once access is active. `null` for an ungoverned item. */
  subtitle$(cipher: CipherViewLike): Observable<string | null> {
    return this.status$(cipher).pipe(
      switchMap((status) =>
        status?.kind !== "active"
          ? of(status?.label ?? null)
          : this.revealedSubtitle$(cipher).pipe(
              map((username) =>
                username ? `${status.label}${SUBTITLE_SEPARATOR}${username}` : status.label,
              ),
            ),
      ),
    );
  }

  /**
   * The row menu's access actions: Request access (disabled unless requestable) or Start access on
   * a gated row, Extend and End access while active. Each reads the status its row last reported.
   */
  rowActions(): readonly VaultItemsTableRowAction<CipherViewLike>[] {
    const statusOf = (cipher: CipherViewLike) => this.reportedStatus(cipher);
    // The list swaps a revealed view in for its restricted row, so a restricted row is not in use.
    const gated = (cipher: CipherViewLike) => CipherViewLikeUtils.isRestricted(cipher);
    return [
      {
        id: "pamStartAccess",
        label: this.i18nService.t("pamStartLeaseButton"),
        icon: "bwi-unlock",
        show: (cipher) => gated(cipher) && statusOf(cipher)?.kind === "ready",
        run: (cipher) => this.startAccess(cipher),
      },
      {
        id: "pamRequestAccess",
        label: this.i18nService.t("pamRequestAccessButton"),
        icon: "bwi-lock-encrypted",
        show: (cipher) => {
          const kind = statusOf(cipher)?.kind;
          return gated(cipher) && kind != null && kind !== "ready";
        },
        disabled: (cipher) => statusOf(cipher)?.kind !== "request",
        run: (cipher) => this.requestAccess(cipher),
      },
      {
        id: "pamExtendAccess",
        label: this.i18nService.t("pamExtendAccessMenuItem"),
        icon: "bwi-clock",
        show: (cipher) => {
          const status = statusOf(cipher);
          return !gated(cipher) && status?.kind === "active" && status.canExtend;
        },
        run: (cipher) => this.extendAccess(cipher),
      },
      {
        id: "pamEndAccess",
        label: this.i18nService.t("pamEndLeaseButton"),
        icon: "bwi-lock",
        show: (cipher) => !gated(cipher) && statusOf(cipher)?.kind === "active",
        run: (cipher) => this.endAccess(cipher),
      },
    ];
  }

  /**
   * The row's last reported status. A row with no icon or subtitle (the list without VFO1) never
   * reports one, so the first ask starts a read. `show` may not write a signal: it starts after.
   */
  private reportedStatus(cipher: CipherViewLike): VaultRowAccessStatus | undefined {
    if (cipher.id == null) {
      return undefined;
    }
    const cipherId = String(cipher.id);
    const status = this.statuses().get(cipherId);
    if (status == null && !this.watched.has(cipherId)) {
      this.watched.set(cipherId, Subscription.EMPTY);
      queueMicrotask(() => {
        if (this.watched.has(cipherId)) {
          this.watched.set(cipherId, this.status$(cipher).subscribe());
        }
      });
    }
    return status;
  }

  private unwatchAll(): void {
    this.watched.forEach((subscription) => subscription.unsubscribe());
    this.watched.clear();
  }

  private record(cipherId: string, status: VaultRowAccessStatus | null): void {
    const statuses = new Map(this.statuses());
    if (status == null) {
      statuses.delete(cipherId);
    } else {
      statuses.set(cipherId, status);
    }
    this.statuses.set(statuses);
  }

  /** The subtitle of the live revealed copy, which a stripped list entry lacks. */
  private revealedSubtitle$(cipher: CipherViewLike): Observable<string | undefined> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.revealedCipherService.revealed$(userId)),
      map((revealed) => {
        const view = cipher.id == null ? undefined : revealed.get(cipher.id as CipherId);
        return view == null ? undefined : CipherViewLikeUtils.subtitle(view, this.i18nService);
      }),
      distinctUntilChanged(),
    );
  }

  /** Whether the active user holds a live revealed copy of the cipher, off the shared reveals stream. */
  private isRevealed$(cipherId: string): Observable<boolean> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.revealedCipherService.revealed$(userId)),
      map((revealed) => revealed.has(cipherId as CipherId)),
      distinctUntilChanged(),
    );
  }

  private toStatus$(
    cipherId: string,
    state: CipherAccessStateView | null,
  ): Observable<VaultRowAccessStatus | null> {
    const badge = cipherAccessBadgeState(state);
    if (badge == null) {
      return of(null);
    }
    if (badge.kind === "active") {
      return this.activeStatus$(cipherId, badge.expiresAt, state?.extensionsAllowed === true);
    }
    return of(this.staticStatus(badge));
  }

  private staticStatus(badge: Exclude<AccessBadgeState, { kind: "active" }>): VaultRowAccessStatus {
    const status = (kind: VaultRowAccessStatus["kind"], key: string): VaultRowAccessStatus => ({
      kind,
      label: this.i18nService.t(key),
      canExtend: false,
    });
    switch (badge.kind) {
      case "pending":
        return status("pending", "pamAccessBadgePending");
      case "unavailable":
        return status("unavailable", "pamUnavailableToRequest");
      case "ready":
        return status("ready", "pamAccessBadgeReady");
      default:
        return status("request", "pamRequestToUse");
    }
  }

  /** Counts down to `expiresAt`, then re-reads the state so a lapsed or extended lease is picked up. */
  private activeStatus$(
    cipherId: string,
    expiresAt: Date,
    canExtend: boolean,
  ): Observable<VaultRowAccessStatus> {
    const locale = this.locale;
    return concat(
      this.ticker.ticks$.pipe(
        startWith(Date.now()),
        map((now) => expiresAt.getTime() - now),
        takeWhile((remainingMs) => remainingMs > 0),
        map((remainingMs) => this.countdownLabel(locale, remainingMs)),
        distinctUntilChanged(),
        map((label): VaultRowAccessStatus => ({ kind: "active", label, canExtend })),
      ),
      defer(() => {
        this.rowState.invalidate(cipherId);
        return EMPTY;
      }),
    );
  }

  /** Whole hours ("8h"), then minutes ("14m"), then "<1m": a row needs no finer than a minute. */
  private countdownLabel(locale: string, remainingMs: number): string {
    if (remainingMs < 60_000) {
      return this.i18nService.t("pamAccessBadgeLessThanMinuteLeft");
    }
    const totalMinutes = Math.ceil(remainingMs / 60_000);
    const duration =
      totalMinutes < 60
        ? formatRemaining(locale, totalMinutes * 60_000)
        : formatRemaining(locale, Math.floor(totalMinutes / 60) * 3_600_000);
    return this.i18nService.t("pamAccessBadgeTimeLeft", duration);
  }

  /**
   * Opens the item, whose banner carries the request form, so a row never shows a second copy of it.
   */
  async requestAccess(cipher: CipherViewLike): Promise<void> {
    if (cipher.id == null) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: CipherViewLikeUtils.getType(cipher) },
    });
  }

  async startAccess(cipher: CipherViewLike): Promise<void> {
    if (cipher.id == null) {
      return;
    }
    const cipherId = String(cipher.id);
    try {
      const state = await this.accessRequestSdkService.getCipherAccessState(cipherId);
      const request = unactivatedApprovedRequest(state);
      if (request == null) {
        return;
      }
      await this.accessRequestSdkService.activateAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
      this.rowState.invalidate(cipherId);
      this.accessRefreshService.notifyAccessChanged(cipherId);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
      });
      this.rowState.invalidate(cipherId);
    }
  }

  /** A denied extension resolves rather than throws, so the returned status picks the toast. */
  async extendAccess(cipher: CipherViewLike): Promise<void> {
    const cipherId = cipher.id == null ? null : String(cipher.id);
    const state =
      cipherId == null ? null : await this.accessRequestSdkService.getCipherAccessState(cipherId);
    const lease = state?.activeLease;
    // The server sends a cap whenever extensions are allowed.
    const maxDurationSeconds = state?.maxExtensionDurationSeconds;
    if (cipherId == null || lease == null || maxDurationSeconds == null) {
      return;
    }
    const request = await firstValueFrom(
      ExtendLeaseDialogComponent.open(this.dialogService, { maxDurationSeconds }).closed,
    );
    if (request == null) {
      return;
    }
    try {
      const extension = await this.accessLeaseSdkService.extendLease(lease.id, request);
      const denied = extension.status === "denied";
      this.toastService.showToast({
        variant: denied ? "warning" : "success",
        message: this.i18nService.t(denied ? "pamExtendLeaseEnded" : "pamExtendLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(
          isUnlicensedError(e) ? "pamLeaseErrorUnlicensed" : "pamExtendLeaseError",
        ),
      });
    } finally {
      this.changed(cipherId);
    }
  }

  async endAccess(cipher: CipherViewLike): Promise<void> {
    const cipherId = cipher.id == null ? null : String(cipher.id);
    const lease = cipherId == null ? undefined : await this.activeLease(cipherId);
    if (cipherId == null || lease == null) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamEndLeaseTitle" },
      content: { key: "pamEndLeaseConfirm" },
      acceptButtonText: { key: "pamEndLeaseButton" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.accessLeaseSdkService.endLease(lease.id, { reason: undefined });
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamEndLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.changed(cipherId);
    }
  }

  /** The live lease read fresh, since the menu may have sat open past a change elsewhere. */
  private async activeLease(cipherId: string) {
    const state = await this.accessRequestSdkService.getCipherAccessState(cipherId);
    return state?.activeLease ?? undefined;
  }

  private changed(cipherId: string): void {
    this.rowState.invalidate(cipherId);
    this.accessRefreshService.notifyAccessChanged(cipherId);
  }
}
