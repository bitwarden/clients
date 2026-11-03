import { Injectable, LOCALE_ID, inject } from "@angular/core";
import { Router } from "@angular/router";
import {
  EMPTY,
  Observable,
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
import {
  VaultRowAccess,
  VaultRowAccessStatus,
} from "@bitwarden/browser/vault/popup/components/vault/vault-row-access/vault-row-access.token";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";

import { VaultRowAccessStateService } from "../vault-row-access-state/vault-row-access-state.service";

/**
 * Binds `VAULT_ROW_ACCESS`: the status each popup vault row shows for a privileged-control item,
 * off the SDK's badge ranking, and the request, start, extend and end actions its overflow menu
 * offers. Nothing is reported until the member is known to be licensed.
 */
@Injectable()
export class BrowserVaultRowAccessService implements VaultRowAccess {
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

  private readonly organizations$ = callerOrganizations$(
    this.accountService,
    this.organizationService,
  );

  private readonly pamEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  status$(cipher: CipherViewLike): Observable<VaultRowAccessStatus | null> {
    const cipherId = cipher.id == null ? null : String(cipher.id);
    if (cipherId == null || !CipherViewLikeUtils.isRestricted(cipher)) {
      return of(null);
    }
    const unlicensed$ =
      cipher.organizationId == null
        ? of(false)
        : this.organizations$.pipe(
            map((organizations) =>
              unlicensedForPam(organizations.find((o) => o.id === cipher.organizationId)),
            ),
          );
    return combineLatest([this.pamEnabled$, unlicensed$]).pipe(
      distinctUntilChanged(([a, b], [c, d]) => a === c && b === d),
      switchMap(([enabled, unlicensed]) =>
        !enabled || unlicensed
          ? of(null)
          : this.rowState
              .state$(cipherId)
              .pipe(switchMap((state) => this.toStatus$(cipherId, state))),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
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
        map((remainingMs): VaultRowAccessStatus => ({
          kind: "active",
          label: this.i18nService.t("pamAccessBadgeTimeLeft", formatRemaining(locale, remainingMs)),
          canExtend,
        })),
      ),
      defer(() => {
        this.rowState.invalidate(cipherId);
        return EMPTY;
      }),
    );
  }

  /**
   * Opens the item, whose banner carries the request form, so a row never shows a second copy of it.
   */
  async requestAccess(cipher: CipherViewLike): Promise<void> {
    if (cipher.id == null) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
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
    const lease = cipherId == null ? undefined : await this.activeLease(cipherId);
    if (cipherId == null || lease == null) {
      return;
    }
    const request = await firstValueFrom(
      ExtendLeaseDialogComponent.open(this.dialogService).closed,
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
