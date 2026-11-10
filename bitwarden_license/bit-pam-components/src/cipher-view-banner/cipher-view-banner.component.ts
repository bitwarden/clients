import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  NgZone,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  from,
  map,
  merge,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  type AccessLeaseView,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  activateAccessErrorMessageKey,
  cipherAccessBadgeState,
  isGovernedCipher,
  liveActiveLease,
  rereadOnLapse,
  isUnlicensedError,
  callerOrganizations$,
  unlicensedForPam,
} from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogRef,
  DialogService,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ExtendLeaseDialogComponent } from "../access-requests/extend-lease-dialog/extend-lease-dialog.component";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import { MyLeasesService } from "../services/my-leases.service";

import { AccessEndedCardComponent } from "./cards/access-ended-card.component";
import { ActiveLeaseCardComponent } from "./cards/active-lease-card.component";
import { ApprovedRequestCardComponent } from "./cards/approved-request-card.component";
import { PendingRequestCardComponent } from "./cards/pending-request-card.component";
import { RequestAccessCardComponent } from "./cards/request-access-card.component";
import { UnavailableCardComponent } from "./cards/unavailable-card.component";
import { UnlicensedCardComponent } from "./cards/unlicensed-card.component";
import { injectPopupLayout } from "./cipher-view-banner-layout";
import { RequestAccessFormComponent } from "./request-access-form/request-access-form.component";
import { RequestAccessSheetComponent } from "./request-access-sheet/request-access-sheet.component";
import { type RequestTerms, requestTerms } from "./request-terms";

/**
 * Cipher-view banner for PAM-governed items. The unlicensed state replaces every other, since the
 * server withholds the credential from an unlicensed holder regardless of lease.
 */
@Component({
  selector: "app-pam-cipher-view-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./cipher-view-banner.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    NgTemplateOutlet,
    TooltipDirective,
    TypographyModule,
    I18nPipe,
    AccessEndedCardComponent,
    ActiveLeaseCardComponent,
    ApprovedRequestCardComponent,
    PendingRequestCardComponent,
    RequestAccessCardComponent,
    RequestAccessFormComponent,
    UnavailableCardComponent,
    UnlicensedCardComponent,
  ],
})
export class CipherViewBannerComponent implements OnInit {
  /** The cipher the view is showing, partial when the server gated it. */
  readonly cipher = input.required<CipherView>();
  /** Set by the cipher view when the item is open in the Admin Console. Not read yet. */
  readonly isAdminConsole = input(false);

  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRequestCancelService = inject(AccessRequestCancelService);
  private readonly accessLeaseSdkService = inject(AccessLeaseSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly myLeasesService = inject(MyLeasesService);
  private readonly revealedCipherService = inject(RevealedCipherService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly injector = inject(Injector);
  protected readonly popupLayout = injectPopupLayout();

  /** Advanced every second while {@link clockAdvances}. */
  protected readonly nowMs = signal(Date.now());

  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  private readonly organizations$ = callerOrganizations$(
    this.accountService,
    this.organizationService,
  );

  /** The active user's revealed ciphers, which stay governed after `partial` is gone. */
  // Anonymous pages (such as Send access) have no active account, so nothing is revealed there.
  private readonly revealed$ = this.accountService.activeAccount$.pipe(
    getOptionalUserId,
    switchMap((userId) =>
      userId == null
        ? of(new Map<CipherId, CipherView>())
        : this.revealedCipherService.revealed$(userId),
    ),
  );

  /** The open cipher when PAM governs it, else `null`. */
  private readonly governedCipher$ = combineLatest([
    toObservable(this.cipher),
    this.enabled$,
    this.revealed$,
  ]).pipe(
    switchMap(([cipher, enabled, revealed]) => {
      if (!enabled || cipher.id == null) {
        return of(null);
      }
      if (isGovernedCipher(cipher, revealed.has(cipher.id as CipherId))) {
        return of(cipher);
      }
      // A live lease keeps governing an item that has since become reachable through a rule-less
      // collection, so the holder can still extend or end it.
      return this.myLeasesService
        .hasActiveLease$(String(cipher.id))
        .pipe(map((held) => (held ? cipher : null)));
    }),
    distinctUntilChanged(),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * The caller's access state, re-read on every {@link AccessRefreshService} change. The reveal
   * provider shares that trigger, so starting access here also reveals the credential.
   */
  protected readonly state = toSignal(
    this.governedCipher$.pipe(
      switchMap((cipher) => {
        if (cipher == null) {
          return of(null);
        }
        const cipherId = String(cipher.id);
        const read$ = () =>
          from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
            catchError((e: unknown) => {
              // An unreadable state renders no banner rather than an error, like the vault-row
              // badge.
              this.logService.error(e);
              return of(null);
            }),
          );
        return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
          switchMap(() => rereadOnLapse(read$, this.ticker.ticks$)),
        );
      }),
    ),
    { initialValue: null },
  );

  /**
   * Read from local membership state, independent of {@link state}, so the unlicensed block still
   * renders when that read fails.
   */
  protected readonly unlicensed = toSignal(
    this.governedCipher$.pipe(
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
    ),
    // `undefined` until the membership read lands, not `false`; treating unknown as licensed
    // would flash the request card.
    { initialValue: undefined },
  );

  /** Read against {@link nowMs}, since a lease ends at its `notAfter` without a re-read. */
  protected readonly activeLease = computed(() => liveActiveLease(this.state(), this.nowMs()));
  protected readonly approvedRequest = computed(() => this.state()?.approvedRequest);
  protected readonly pendingRequest = computed(() => this.state()?.pendingRequest);

  /** The rule refuses a new request right now, for example outside its IP allowlist. */
  protected readonly unavailable = computed(
    () => cipherAccessBadgeState(this.state())?.kind === "unavailable",
  );

  /** Whether a card sits under the "Privileged credentials" heading, so the heading never stands alone. */
  protected readonly showsPrivilegedCard = computed(
    () =>
      this.activeLease() != null ||
      this.approvedRequest() != null ||
      this.pendingRequest() != null ||
      this.accessEnded() ||
      this.unavailable() ||
      this.canRequestAccess(),
  );

  protected readonly canExtendLease = computed(() => this.state()?.extensionsAllowed === true);

  /**
   * Requires a still-gated (`partial`) cipher. A revealed cipher without a live lease has lapsed,
   * and the dialog falls back to the `partial` copy, which re-drives the resting banner.
   */
  protected readonly canRequestAccess = computed(
    () =>
      this.state() != null &&
      this.cipher().partial &&
      this.unlicensed() === false &&
      this.activeLease() == null &&
      this.approvedRequest() == null &&
      this.pendingRequest() == null &&
      !this.unavailable(),
  );

  /** The governing rule's terms for the resting banner, from `preCheck`, since {@link state} carries none. */
  protected readonly restingRequestTerms = toSignal<RequestTerms | null>(
    toObservable(computed(() => (this.canRequestAccess() ? this.cipher().id : null))).pipe(
      switchMap((cipherId) =>
        cipherId == null
          ? of(null)
          : from(this.accessRequestSdkService.preCheck(String(cipherId))).pipe(
              map(requestTerms),
              catchError((e: unknown) => {
                this.logService.error(e);
                return of(null);
              }),
            ),
      ),
    ),
    { initialValue: null },
  );

  /**
   * Set when a lease the user was holding runs out on its own, so the item explains why it went
   * back to masked. A lease the user ends does not set it, and a new active lease, request or
   * cipher clears it.
   */
  protected readonly accessEnded = signal(false);
  private readonly endTracking: { lastLive: AccessLeaseView | undefined; endedByUser: boolean } = {
    lastLive: undefined,
    endedByUser: false,
  };

  /** Whether anything on screen still reads {@link nowMs}. */
  private readonly clockAdvances = computed(
    () => this.activeLease() != null || this.pendingRequest() != null,
  );

  /** The inline form, open in place of Request access. */
  protected readonly requestFormOpen = signal(false);
  private readonly requestSheet = signal<DialogRef<boolean> | undefined>(undefined);
  private readonly requestToggleButton = viewChild("requestToggleButton", {
    read: ElementRef<HTMLElement>,
  });
  private readonly requestFoldOut = viewChild("requestFoldOut", { read: ElementRef<HTMLElement> });

  constructor() {
    effect(() => {
      const lease = this.activeLease();
      const request = this.approvedRequest() ?? this.pendingRequest();
      untracked(() => {
        if (lease != null) {
          this.endTracking.lastLive = lease;
          this.accessEnded.set(false);
          return;
        }
        if (request != null) {
          this.accessEnded.set(false);
        }
        const previous = this.endTracking.lastLive;
        this.endTracking.lastLive = undefined;
        if (
          previous != null &&
          !this.endTracking.endedByUser &&
          Date.parse(previous.notAfter) <= this.nowMs()
        ) {
          this.accessEnded.set(true);
        }
        this.endTracking.endedByUser = false;
      });
    });

    // Closes the form with the card, so it never offers a request that no longer applies. The sheet
    // also closes with the banner, since DialogService leaves it open across navigation.
    effect(() => {
      if (!this.canRequestAccess()) {
        this.requestFormOpen.set(false);
        void untracked(this.requestSheet)?.close();
      }
    });
    this.destroyRef.onDestroy(() => void this.requestSheet()?.close());
  }

  ngOnInit(): void {
    // Kept outside the Angular zone: an in-zone periodic timer never lets NgZone settle, which would
    // hang `fixture.whenStable()`. The signal write still drives change detection.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => {
        if (this.clockAdvances()) {
          this.nowMs.set(Date.now());
        }
      }, 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });
  }

  protected openRequest(): void {
    if (this.popupLayout) {
      void this.openRequestSheet();
      return;
    }
    this.requestFormOpen.set(true);
    // The form replaces the button that opened it, which would otherwise take focus with it.
    afterNextRender(() => this.requestFoldOut()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** Returns focus to Request access, which the form replaced. */
  protected closeRequestForm(): void {
    this.requestFormOpen.set(false);
    afterNextRender(() => this.requestToggleButton()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected closeRequestFormAndRefresh(): void {
    this.requestFormOpen.set(false);
    this.notifyAccessChanged();
  }

  private async openRequestSheet(): Promise<void> {
    // A second activation can land before focus moves into the sheet.
    if (this.requestSheet() != null) {
      return;
    }
    const cipher = this.cipher();
    const sheet = RequestAccessSheetComponent.open(this.dialogService, {
      cipherId: cipher.id,
      itemName: cipher.name,
    });
    this.requestSheet.set(sheet);
    const accessChanged = await firstValueFrom(sheet.closed);
    this.requestSheet.set(undefined);
    if (accessChanged) {
      this.notifyAccessChanged();
    }
  }

  protected readonly activateRequest = async (): Promise<void> => {
    const approved = this.approvedRequest();
    if (approved == null) {
      return;
    }
    try {
      await this.accessRequestSdkService.activateAccessRequest(approved.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      // A taken single-active-lease slot surfaces here; the approved request stays activatable.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  /**
   * Withdraws the pending or approved request. The shared cancel flow toasts the outcome and
   * announces the refresh.
   */
  protected readonly cancelRequest = async (): Promise<void> => {
    const cipherId = this.cipher().id;
    if (cipherId == null || (this.pendingRequest() ?? this.approvedRequest()) == null) {
      return;
    }
    await this.accessRequestCancelService.cancelOutstandingRequest(String(cipherId));
  };

  /**
   * A denied extension resolves rather than throws, so this branches on the returned status, or an
   * expired-lease denial would read as success.
   */
  protected readonly extendLease = async (): Promise<void> => {
    const lease = this.activeLease();
    // The server sends a cap whenever extensions are allowed.
    const maxDurationSeconds = this.state()?.maxExtensionDurationSeconds;
    if (lease == null || maxDurationSeconds == null) {
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
        // Reachable only if the seat is withdrawn between render and click; the unlicensed state
        // otherwise replaces this card.
        message: this.i18nService.t(
          isUnlicensedError(e) ? "pamLeaseErrorUnlicensed" : "pamExtendLeaseError",
        ),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  protected readonly endLease = async (): Promise<void> => {
    const lease = this.activeLease();
    if (lease == null) {
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
      this.endTracking.endedByUser = true;
      await this.accessLeaseSdkService.endLease(lease.id, { reason: undefined });
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamEndLeaseSuccess"),
      });
    } catch (e) {
      this.endTracking.endedByUser = false;
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  /** Re-reads the state here and lets the gated-cipher reloader reveal or re-lock the item. */
  private notifyAccessChanged(): void {
    // The gate for an ungated-but-leased item reads the cached lease list, which must not outlive
    // a mutation that ended or extended the lease.
    this.myLeasesService.invalidate();
    const cipherId = this.cipher().id;
    if (cipherId != null) {
      this.accessRefreshService.notifyAccessChanged(String(cipherId));
    }
  }
}
