import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  AccessBadgeState,
  AccessRefreshService,
  AccessRequestSdkService,
  type AccessRequestView,
  type CipherAccessStateView,
  activateAccessErrorMessageKey,
  cipherAccessBadgeState,
} from "@bitwarden/bit-common/pam";
import {
  callerOrganizations$,
  unlicensedForPam,
} from "@bitwarden/bit-common/pam/services/pam-membership";
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
import { ChipActionComponent, DialogService, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { RequestAccessDialogComponent } from "../request-access-dialog/request-access-dialog.component";
import { VaultRowAccessStateService } from "../vault-row-access-state/vault-row-access-state.service";

/** The one element a gated row shows in its action slot. */
type RowAccessAction =
  | { readonly kind: "request" }
  | { readonly kind: "start"; readonly request: AccessRequestView }
  | { readonly kind: "badge"; readonly badge: AccessBadgeState };

/**
 * Binds `VAULT_ROW_ACCESS_ACTION`: what a gated row renders in place of the copy actions in the
 * popup vault list, off the SDK's badge ranking. "Request" when requestable, "Start" for an
 * approved request not yet started, the access-state pill otherwise, and nothing until the member
 * is known to be licensed.
 */
@Component({
  selector: "app-pam-vault-row-access-action",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccessStateBadgeComponent, ChipActionComponent, I18nPipe],
  templateUrl: "./vault-row-access-action.component.html",
})
export class VaultRowAccessActionComponent {
  readonly cipher = input<CipherViewLike | null>(null);
  /** `status` renders pills only (compact, beside the name); `action` renders chips only. */
  readonly render = input<"status" | "action">("action");

  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly dialogService = inject(DialogService);
  private readonly accessRowStateService = inject(VaultRowAccessStateService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  private readonly organizations$ = callerOrganizations$(
    this.accountService,
    this.organizationService,
  );

  /** The row's cipher when PAM governs it, `null` otherwise. */
  private readonly gatedCipher$: Observable<CipherViewLike | null> = combineLatest([
    toObservable(this.cipher),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
  ]).pipe(
    map(([cipher, enabled]) => {
      if (!enabled || cipher == null || cipher.id == null) {
        return null;
      }
      const leaseGated = "leaseGated" in cipher && cipher.leaseGated === true;
      return CipherViewLikeUtils.isPartial(cipher) || leaseGated ? cipher : null;
    }),
    distinctUntilChanged(),
  );

  private readonly state$: Observable<CipherAccessStateView | null> = this.gatedCipher$.pipe(
    switchMap((cipher) =>
      cipher == null ? of(null) : this.accessRowStateService.state$(String(cipher.id)),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** `false` licensed, `true` unlicensed. Never emits before membership loads. */
  private readonly unlicensed$: Observable<boolean> = this.gatedCipher$.pipe(
    map((cipher) => cipher?.organizationId ?? null),
    distinctUntilChanged(),
    switchMap((organizationId) =>
      organizationId == null
        ? of(false)
        : this.organizations$.pipe(
            map((organizations) =>
              unlicensedForPam(organizations.find((o) => o.id === organizationId)),
            ),
          ),
    ),
  );

  protected readonly action = toSignal(
    combineLatest([this.state$, this.unlicensed$]).pipe(
      map(([state, unlicensed]) => (unlicensed === false ? rowAccessAction(state) : null)),
    ),
    { initialValue: null },
  );

  /** Whether a Start is in flight. */
  protected readonly starting = signal(false);

  protected readonly requestAccess = async (event: Event): Promise<void> => {
    event.stopPropagation();
    const cipher = this.cipher();
    if (cipher?.id == null) {
      return;
    }
    const cipherId = String(cipher.id);
    const result = await firstValueFrom(
      RequestAccessDialogComponent.open(this.dialogService, {
        cipherId,
        itemName: cipher.name,
      }).closed,
    );
    if (result != null) {
      this.accessRowStateService.invalidate(cipherId);
    }
  };

  protected readonly startAccess = async (
    event: Event,
    request: AccessRequestView,
  ): Promise<void> => {
    event.stopPropagation();
    const cipherId = this.cipher()?.id;
    if (cipherId == null || this.starting()) {
      return;
    }
    this.starting.set(true);
    try {
      await this.accessRequestSdkService.activateAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
      this.accessRowStateService.invalidate(String(cipherId));
      this.accessRefreshService.notifyAccessChanged(String(cipherId));
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
      });
      this.accessRowStateService.invalidate(String(cipherId));
    } finally {
      this.starting.set(false);
    }
  };
}

function rowAccessAction(state: CipherAccessStateView | null): RowAccessAction | null {
  const badge = cipherAccessBadgeState(state);
  switch (badge?.kind) {
    case undefined:
      return null;
    case "privileged":
      return { kind: "request" };
    case "ready": {
      const request = unactivatedApprovedRequest(state);
      return request == null ? { kind: "badge", badge } : { kind: "start", request };
    }
    default:
      return { kind: "badge", badge };
  }
}

/** The approved request still awaiting Start; an activated one carries `producedLeaseId`. */
function unactivatedApprovedRequest(
  state: CipherAccessStateView | null,
): AccessRequestView | undefined {
  const approved = state?.approvedRequest;
  return approved?.producedLeaseId == null ? approved : undefined;
}
