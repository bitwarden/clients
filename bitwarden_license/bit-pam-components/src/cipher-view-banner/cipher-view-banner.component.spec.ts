import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of, Subject } from "rxjs";

import {
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  LeasingErrorService,
  ACCESS_BADGE_LOOK,
  formatCalendarDate,
  formatTimeOfDay,
  DefaultAccessRefreshService,
} from "@bitwarden/bit-pam";
import type {
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestView,
  CipherAccessStateView,
} from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonComponent, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import { MyLeasesService } from "../services/my-leases.service";

import { CIPHER_VIEW_BANNER_LAYOUT } from "./cipher-view-banner-layout";
import { CipherViewBannerComponent } from "./cipher-view-banner.component";
import { RequestAccessFormComponent } from "./request-access-form/request-access-form.component";
import { RequestAccessSheetComponent } from "./request-access-sheet/request-access-sheet.component";

/**
 * The SDK views are wide, so the builders below set only the fields the banner reads and widen
 * through `unknown`.
 */
function leaseView(overrides: Partial<AccessLeaseView> = {}): AccessLeaseView {
  return {
    id: "lease-1",
    notAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  } as unknown as AccessLeaseView;
}

function requestView(overrides: Partial<AccessRequestView> = {}): AccessRequestView {
  return {
    id: "request-1",
    // The server always resolves both bounds at submit.
    leaseNotBefore: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    leaseNotAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  } as unknown as AccessRequestView;
}

/**
 * An activation window override for {@link requestView}. `startsInSeconds` models a human-approval
 * window that opens in the future.
 */
function grantedWindow(lengthSeconds: number, startsInSeconds = 0): Partial<AccessRequestView> {
  const startMs = Date.now() + startsInSeconds * 1000;
  return {
    leaseNotBefore: new Date(startMs).toISOString(),
    leaseNotAfter: new Date(startMs + lengthSeconds * 1000).toISOString(),
  } as unknown as Partial<AccessRequestView>;
}

/**
 * Mirrors the SDK's badge ranking so a fixture stays faithful to a real response; the SDK tests the
 * ranking itself.
 */
function badgeStateFor(state: CipherAccessStateView): CipherAccessStateView["badgeState"] {
  if (state.activeLease != null) {
    return { active: { expiresAt: state.activeLease.notAfter } };
  }
  if (state.approvedRequest != null) {
    return "ready";
  }
  return state.pendingRequest != null ? "pending" : "privileged";
}

function accessState(overrides: Partial<CipherAccessStateView> = {}): CipherAccessStateView {
  const state = {
    cipherId: "cipher-1",
    activeLease: undefined,
    pendingRequest: undefined,
    approvedRequest: undefined,
    extensionsAllowed: false,
    maxExtensionDurationSeconds: undefined,
    ...overrides,
  } as unknown as CipherAccessStateView;

  return { ...state, badgeState: state.badgeState ?? badgeStateFor(state) };
}

function preCheck(overrides: Partial<AccessPreCheckView> = {}): AccessPreCheckView {
  return {
    cipherId: "cipher-1",
    approvalMode: "automatic",
    maxDurationSeconds: 86_400,
    ...overrides,
  } as unknown as AccessPreCheckView;
}

const ORGANIZATION_ID = "org-1";

/**
 * A real `Organization`, so the licensing predicate under test is the shipped one. A case can omit
 * `accessPam` to model an un-synced membership.
 */
function organization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: ORGANIZATION_ID,
    enabled: true,
    isProviderUser: false,
    ...overrides,
  });
}

describe("CipherViewBannerComponent", () => {
  let fixture: ComponentFixture<CipherViewBannerComponent>;
  let component: CipherViewBannerComponent;
  let enabled$: BehaviorSubject<boolean>;
  let revealed$: BehaviorSubject<ReadonlyMap<CipherId, CipherView>>;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let organizations$: BehaviorSubject<Organization[]>;
  let myLeases: MockProxy<MyLeasesService>;

  function gatedCipher(overrides: Partial<CipherView> = {}): CipherView {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.partial = true;
    return Object.assign(cipher, overrides);
  }

  async function create(cipher: CipherView): Promise<void> {
    fixture = TestBed.createComponent(CipherViewBannerComponent);
    fixture.componentRef.setInput("cipher", cipher);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // The resting pre-check only resolves after the access-state read settles, landing a cycle
    // later.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  function buttonSize(selector: string): string | undefined {
    return fixture.debugElement.query(By.css(selector))?.injector.get(ButtonComponent).size();
  }

  /** Lays the banner out as the extension does; call before {@link create}. */
  function usePopupLayout(): void {
    TestBed.overrideProvider(CIPHER_VIEW_BANNER_LAYOUT, { useValue: "popup" });
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  /**
   * Announces on {@link AccessRefreshService} and lets the re-read render `next`, as a real change
   * does.
   */
  async function refreshTo(next: CipherAccessStateView): Promise<void> {
    requestsApi.getCipherAccessState.mockResolvedValue(next);
    TestBed.inject(AccessRefreshService).notifyAccessChanged("cipher-1");
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    revealed$ = new BehaviorSubject<ReadonlyMap<CipherId, CipherView>>(new Map());
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    // Licensed by default, so only the licensing tests below concern themselves with it.
    organizations$ = new BehaviorSubject<Organization[]>([
      organization({ usePam: true, accessPam: true }),
    ]);

    requestsApi.getCipherAccessState.mockResolvedValue(accessState());
    // The resting banner pre-checks on its own to render the rule's maximum.
    requestsApi.preCheck.mockResolvedValue(preCheck());

    // No lease held by default: the widened gate only opens for an ungated cipher the caller
    // still holds a lease on.
    myLeases = mock<MyLeasesService>();
    myLeases.hasActiveLease$.mockReturnValue(of(false));

    // Uses the real fan-out, not a mock, since notify-then-re-read is the behavior under test.
    const accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    });
    const logService = mock<LogService>();
    const i18nService = {
      t: (key: string, ...args: unknown[]) => [key, ...args].join(" "),
    } as I18nService;

    TestBed.configureTestingModule({
      imports: [CipherViewBannerComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessRefreshService, useValue: accessRefresh },
        // The real shared cancel flow, exercised end to end over the same mocks.
        {
          provide: AccessRequestCancelService,
          useValue: new AccessRequestCancelService(
            requestsApi,
            accessRefresh,
            dialogService,
            toastService,
            i18nService,
            logService,
          ),
        },
        { provide: LeasingErrorService, useValue: { isLeasingError: () => false } },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: CIPHER_VIEW_BANNER_LAYOUT, useValue: "dialog" },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: I18nService, useValue: i18nService },
        { provide: MyLeasesService, useValue: myLeases },
        { provide: RevealedCipherService, useValue: { revealed$: () => revealed$ } },
      ],
    });
  });

  describe("licensing", () => {
    // The shared `gatedCipher()` leaves organizationId unset to stay focused on the rule.
    function orgGatedCipher(overrides: Partial<CipherView> = {}): CipherView {
      return gatedCipher({ organizationId: ORGANIZATION_ID, ...overrides });
    }

    it("blocks an unlicensed member with an explanation instead of a request form", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
      expect(query("[data-testid='cipher-view-banner-request']")).toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();
      expect(
        query("[data-testid='cipher-view-banner-unlicensed'] bit-icon-tile bit-icon.bwi-key"),
      ).not.toBeNull();
      expect(text()).toContain("pamUnlicensedBannerHeadingV2");
      expect(text()).toContain("pamUnlicensedBannerBodyV2");
      expect(text()).not.toContain("pamUnlicensedBannerRequestUnavailable");
    });

    it("shows the card alone in the item dialog", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-disabled")).toBeNull();
      expect(query("[data-testid='cipher-view-banner-section-heading']")).toBeNull();
    });

    it("shows a disabled Request access button that names the missing license on hover, in the popup", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);
      usePopupLayout();

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-section-heading']")).not.toBeNull();
      const button = query("#pam-cipher-view-banner_button_request-disabled");
      expect(button).not.toBeNull();
      expect(
        button?.hasAttribute("disabled") || button?.getAttribute("aria-disabled"),
      ).toBeTruthy();
      expect(button?.textContent).toContain("pamRequestAccessButton");
      expect(query("[data-testid='cipher-view-banner-license-tooltip']")).not.toBeNull();
    });

    it("spends no pre-check on a member who cannot request anything", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);

      await create(orgGatedCipher());

      expect(requestsApi.preCheck).not.toHaveBeenCalled();
    });

    it("offers the request form to a licensed member", async () => {
      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).toBeNull();
      expect(query("[data-testid='cipher-view-banner-request']")).not.toBeNull();
    });

    it("replaces even an active lease with the block", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView(), extensionsAllowed: true }),
      );

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
      expect(query("[data-testid='cipher-view-banner-active']")).toBeNull();
      expect(query("#pam-cipher-view-banner_button_extend")).toBeNull();
    });

    it("replaces an approved request's card with the block", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView() }),
      );

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_start")).toBeNull();
    });

    it("replaces a pending request's card with the block", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView() }),
      );

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
      expect(query("[data-testid='cipher-view-banner-pending']")).toBeNull();
    });

    it("offers no request card until licensing is known", async () => {
      organizations$ = new BehaviorSubject<Organization[]>([]);
      const pending$ = new Subject<Organization[]>();
      TestBed.overrideProvider(OrganizationService, {
        useValue: { organizations$: () => pending$ },
      });

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-request']")).toBeNull();
      expect(requestsApi.preCheck).not.toHaveBeenCalled();

      pending$.next([organization({ usePam: true, accessPam: true })]);
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(query("[data-testid='cipher-view-banner-request']")).not.toBeNull();
    });

    it("still blocks when the access-state read fails", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);
      requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
    });
  });

  describe("gating", () => {
    it("renders nothing and reads no access state for a cipher that is not PAM-governed", async () => {
      await create(gatedCipher({ partial: false }));

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
      expect(query("bit-card")).toBeNull();
    });

    it("accepts isAdminConsole without changing what it reads", async () => {
      fixture = TestBed.createComponent(CipherViewBannerComponent);
      fixture.componentRef.setInput("cipher", gatedCipher());
      fixture.componentRef.setInput("isAdminConsole", true);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isAdminConsole()).toBe(true);
      expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    });

    it("renders nothing when the PAM feature flag is off", async () => {
      enabled$.next(false);

      await create(gatedCipher());

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
      expect(query("bit-card")).toBeNull();
    });

    it("reads access state for a revealed cipher whose partial data is gone", async () => {
      // After a reveal the full view has no `partial` flag; the revealed map keeps the countdown alive.
      const revealed = gatedCipher({ partial: false });
      revealed$.next(new Map([["cipher-1" as CipherId, revealed]]));
      await create(revealed);

      expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    });

    it("renders nothing when the access-state read fails", async () => {
      requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

      await create(gatedCipher());

      expect(query("bit-card")).toBeNull();
    });

    // The item gained a rule-less collection after the lease was minted, so it is neither `partial`
    // nor revealed while the lease is still live.
    it("reads access state for an ungated cipher the caller still holds a lease on", async () => {
      myLeases.hasActiveLease$.mockReturnValue(of(true));

      await create(gatedCipher({ partial: false }));

      expect(myLeases.hasActiveLease$).toHaveBeenCalledWith("cipher-1");
      expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    });

    it("offers no request form for an ungated cipher, lease held or not", async () => {
      myLeases.hasActiveLease$.mockReturnValue(of(true));

      await create(gatedCipher({ partial: false }));

      expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();
      expect(query("[data-testid='cipher-view-banner-request']")).toBeNull();
    });
  });

  describe("state rendering", () => {
    it("offers Request access for a gated cipher with nothing in play", async () => {
      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();
      expect(text()).toContain("pamRequestAccessBannerHeading");
      expect(text()).toContain("pamRequestAccessBannerBody");
    });

    it("puts a small Request access button inside the request card in the item dialog", async () => {
      await create(gatedCipher());

      const button = query("#pam-cipher-view-banner_button_request-toggle");
      expect(button?.closest('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
      expect(button?.classList.contains("tw-w-full")).toBe(false);
      expect(query('[data-testid="cipher-view-banner-section-heading"]')).toBeNull();
    });

    it("puts a full-width Request access button with a lock icon inside the request card, under the section heading, in the popup", async () => {
      usePopupLayout();
      await create(gatedCipher());

      const button = query("#pam-cipher-view-banner_button_request-toggle");
      expect(button?.closest('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
      expect(button?.classList.contains("tw-w-full")).toBe(true);
      expect(button?.querySelector(".bwi-lock")).not.toBeNull();
      const heading = query('[data-testid="cipher-view-banner-section-heading"]');
      expect(heading?.textContent).toContain("pamPrivilegedCredentialsHeading");
      expect(
        heading!.compareDocumentPosition(button!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("shows the item as unavailable, with no Request access, when the rule refuses a request", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ badgeState: "unavailable" }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-unavailable"]')).not.toBeNull();
      expect(text()).toContain("pamUnavailableBannerHeading");
      expect(text()).toContain("pamUnavailableBannerBody");
      expect(query('[data-testid="cipher-view-banner-request"]')).toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();
      expect(requestsApi.preCheck).not.toHaveBeenCalled();
    });

    it("drops the full-width Request access button but keeps the section heading, in the popup", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ badgeState: "unavailable" }),
      );
      usePopupLayout();

      await create(gatedCipher());

      expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();
      expect(query('[data-testid="cipher-view-banner-section-heading"]')?.textContent).toContain(
        "pamPrivilegedCredentialsHeading",
      );
      expect(query('[data-testid="cipher-view-banner-unavailable"]')).not.toBeNull();
    });

    it("offers Request access again once the rule allows a request", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ badgeState: "unavailable" }),
      );
      await create(gatedCipher());

      await refreshTo(accessState());

      expect(query('[data-testid="cipher-view-banner-unavailable"]')).toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();
    });

    it("puts Cancel request inside the pending card in the item dialog", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView({ submittedAt: new Date().toISOString() }) }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-pending-submitted"]')?.textContent).toContain(
        "pamPendingSubmittedJustNow",
      );
      const cancel = query("#pam-cipher-view-banner_button_cancel");
      expect(cancel?.closest('[data-testid="cipher-view-banner-pending"]')).not.toBeNull();
      expect(cancel?.classList.contains("tw-w-full")).toBe(false);
    });

    it("shows a pending request as submitted just now, with Cancel inside its card, in the popup", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView({ submittedAt: new Date().toISOString() }) }),
      );
      usePopupLayout();

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-pending-submitted"]')?.textContent).toContain(
        "pamPendingSubmittedJustNow",
      );
      const cancel = query("#pam-cipher-view-banner_button_cancel");
      expect(cancel?.closest('[data-testid="cipher-view-banner-pending"]')).not.toBeNull();
    });

    it("offers Cancel request while a request is pending", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView() }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-pending"]')).not.toBeNull();
      expect(text()).toContain("pamPendingRequestBannerHeading");
      expect(query("#pam-cipher-view-banner_button_cancel")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();
    });

    it("offers Start access on an approved request, with no duration or window line", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView(grantedWindow(3600)) }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-approved"]')).not.toBeNull();
      expect(text()).toContain("pamApprovedRequestBannerHeadingV2");
      expect(query('[data-testid="cipher-view-banner-approved-hint"]')?.textContent).toContain(
        "pamApprovedAccessUntil",
      );
      expect(query('[data-testid="cipher-view-banner-approved-duration"]')).toBeNull();
      expect(query('[data-testid="approved-access-window"]')).toBeNull();
      expect(query("#pam-cipher-view-banner_button_start")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_cancel-approved")).toBeNull();
    });

    it("keeps Start access small in the item dialog", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView(grantedWindow(3600)) }),
      );

      await create(gatedCipher());

      expect(buttonSize("#pam-cipher-view-banner_button_start")).toBe("small");
      expect(query("#pam-cipher-view-banner_button_start")?.classList.contains("tw-w-full")).toBe(
        false,
      );
    });

    it("makes Start access full-width in the popup", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView(grantedWindow(3600)) }),
      );
      usePopupLayout();

      await create(gatedCipher());

      expect(buttonSize("#pam-cipher-view-banner_button_start")).toBe("default");
      expect(query("#pam-cipher-view-banner_button_start")?.classList.contains("tw-w-full")).toBe(
        true,
      );
    });
  });

  describe("the absolute expiry beside the countdown", () => {
    // Local noon, so a half-hour lease is "today" in any zone.
    const NOON = new Date(2026, 0, 1, 12, 0).getTime();

    // Pinned rather than faked: a fake timer would stall `fixture.whenStable()`.
    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOON);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function lowerTime(iso: string): string {
      return formatTimeOfDay("en-US", Date.parse(iso)).toLocaleLowerCase("en-US");
    }

    function collapseSpace(value: string | null | undefined): string {
      return (value ?? "").replace(/\s+/g, " ").trim();
    }

    it("spells out the days left and the date the lease ends on", async () => {
      const endsAt = new Date(NOON + 20 * 24 * 60 * 60 * 1000 + 60 * 1000).toISOString();
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView({ notAfter: endsAt }) }),
      );

      await create(gatedCipher());

      expect(text()).toContain("pamActiveLeaseBannerTitleV2 20 days");
      expect(collapseSpace(query('[data-testid="active-lease-ends-at"]')?.textContent)).toBe(
        collapseSpace(
          `pamLeaseExpires ${formatCalendarDate("en-US", Date.parse(endsAt))} ${lowerTime(endsAt)}`,
        ),
      );
    });

    it("says today, not the date, for a lease that ends the same day", async () => {
      const endsAt = new Date(NOON + 30 * 60 * 1000).toISOString();
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView({ notAfter: endsAt }) }),
      );

      await create(gatedCipher());

      expect(text()).toContain("pamActiveLeaseBannerTitleV2 30 minutes");
      expect(collapseSpace(query('[data-testid="active-lease-ends-at"]')?.textContent)).toBe(
        collapseSpace(`pamLeaseExpiresToday ${lowerTime(endsAt)}`),
      );
    });
  });

  describe("the end time on an approved request", () => {
    // Local noon, so a half-hour window is "today" in any zone.
    const NOON = new Date(2026, 0, 1, 12, 0).getTime();

    // Pinned rather than faked, for the reason given on the countdown suite above.
    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOON);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function hint(): string {
      return (query('[data-testid="cipher-view-banner-approved-hint"]')?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
    }

    it("says until when today, from the end of the approved window", async () => {
      const endsAt = new Date(NOON + 30 * 60 * 1000).toISOString();
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView({ leaseNotAfter: endsAt } as never) }),
      );

      await create(gatedCipher());

      expect(hint()).toBe(
        `pamApprovedAccessUntilToday ${formatTimeOfDay("en-US", Date.parse(endsAt))}`,
      );
    });

    it("adds the date for a window that ends on another day", async () => {
      const endsAt = new Date(NOON + 2 * 24 * 60 * 60 * 1000).toISOString();
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView({ leaseNotAfter: endsAt } as never) }),
      );

      await create(gatedCipher());

      const endMs = Date.parse(endsAt);
      expect(hint()).toBe(
        `pamApprovedAccessUntil ${formatTimeOfDay("en-US", endMs)} ${formatCalendarDate("en-US", endMs)}`,
      );
    });
  });

  describe("the five-minute escalation on the active lease", () => {
    const NOW = Date.parse("2026-01-01T15:00:00.000Z");

    // Pinned rather than faked, for the reason given on the countdown suite above.
    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    /** An active lease ending `offsetMs` from the pinned now; negative for one already lapsed. */
    async function activeLeaseEndingIn(offsetMs: number): Promise<void> {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          activeLease: leaseView({ notAfter: new Date(NOW + offsetMs).toISOString() }),
          extensionsAllowed: true,
        }),
      );

      await create(gatedCipher());
    }

    function glyph(name: string): Element | null | undefined {
      return query('bit-card[data-testid="cipher-view-banner-active"]')?.querySelector(
        `bit-icon-tile bit-icon.${name}`,
      );
    }

    it("warns inside the threshold and, as designed, carries no actions", async () => {
      await activeLeaseEndingIn(4 * 60 * 1000);

      expect(query('[data-testid="active-lease-ending-soon"]')?.textContent?.trim()).toBe(
        "pamActiveLeaseBannerEndingSoonTitleV2 4 minutes",
      );
      expect(query('[data-testid="active-lease-countdown"]')).toBeNull();
      // Read off the constant, not spelled again: this card escalates on the same threshold the
      // badge does, so it has to wear the badge's warning.
      expect(glyph(ACCESS_BADGE_LOOK.endingSoon.icon)).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_extend")).toBeNull();
      expect(query("#pam-cipher-view-banner_button_end")).toBeNull();
    });

    it("keeps Extend access and End access small in the item dialog", async () => {
      await activeLeaseEndingIn(60 * 60 * 1000);

      for (const id of [
        "#pam-cipher-view-banner_button_extend",
        "#pam-cipher-view-banner_button_end",
      ]) {
        expect(buttonSize(id)).toBe("small");
        expect(query(id)?.classList.contains("tw-flex-1")).toBe(false);
      }
    });

    it("lists Extend access before End access, each filling half the row, in the popup", async () => {
      usePopupLayout();
      await activeLeaseEndingIn(60 * 60 * 1000);

      const end = query("#pam-cipher-view-banner_button_end");
      const extend = query("#pam-cipher-view-banner_button_extend");
      expect(end).not.toBeNull();
      expect(extend).not.toBeNull();
      expect(extend!.compareDocumentPosition(end!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(end!.classList.contains("tw-flex-1")).toBe(true);
      expect(extend!.classList.contains("tw-flex-1")).toBe(true);
      expect(buttonSize("#pam-cipher-view-banner_button_end")).toBe("default");
    });

    it("warns at exactly five minutes remaining", async () => {
      await activeLeaseEndingIn(5 * 60 * 1000);

      expect(query('[data-testid="active-lease-ending-soon"]')?.textContent?.trim()).toBe(
        "pamActiveLeaseBannerEndingSoonTitleV2 5 minutes",
      );
    });

    it("rests above the threshold, whatever the lease's total length", async () => {
      await activeLeaseEndingIn(6 * 60 * 1000);

      expect(query('[data-testid="active-lease-countdown"]')?.textContent?.trim()).toBe(
        "pamActiveLeaseBannerTitleV2 6 minutes",
      );
      expect(query('[data-testid="active-lease-ending-soon"]')).toBeNull();
      expect(glyph("bwi-unlock")).not.toBeNull();
    });

    it("shows no active card at all for a lease that lapsed before the read landed", async () => {
      await activeLeaseEndingIn(-60 * 1000);

      expect(query('bit-card[data-testid="cipher-view-banner-active"]')).toBeNull();
      expect(query('[data-testid="active-lease-ending-soon"]')).toBeNull();
      expect(query('bit-card[data-testid="cipher-view-banner-request"]')).not.toBeNull();
    });
  });

  describe("a lease that runs out with the item open", () => {
    const NOW = Date.parse("2026-01-01T15:00:00.000Z");
    const ENDS_AT = new Date(NOW + 60_000).toISOString();

    // Pinned rather than faked, since a fake timer would stall `fixture.whenStable()`. Moving the
    // pin forward is the whole event; nothing is announced or clicked.
    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    /** The banner's countdown runs on a real interval; a tick is only observed by outlasting it. */
    function waitForTick(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 1_100));
    }

    async function openWithLeaseEndingAt(iso: string): Promise<void> {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView({ notAfter: iso }) }),
      );
      await create(gatedCipher());
    }

    it("shows the Access ended card and offers a new request once the window closes", async () => {
      await openWithLeaseEndingAt(ENDS_AT);
      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();

      jest.spyOn(Date, "now").mockReturnValue(NOW + 61_000);
      await waitForTick();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).toBeNull();
      expect(query('[data-testid="cipher-view-banner-ended"]')).not.toBeNull();
      expect(text()).toContain("pamEndedBannerHeading");
      expect(text()).toContain("pamEndedBannerBody");
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();
    });

    it("locks even when a trailing server clock still reports the lease", async () => {
      await openWithLeaseEndingAt(ENDS_AT);
      expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);

      jest.spyOn(Date, "now").mockReturnValue(NOW + 61_000);
      await waitForTick();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).toBeNull();
      expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(2);
    });

    it("keeps the active card past the original end of a lease extended elsewhere", async () => {
      await openWithLeaseEndingAt(ENDS_AT);

      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          activeLease: leaseView({ notAfter: new Date(NOW + 1_860_000).toISOString() }),
        }),
      );
      jest.spyOn(Date, "now").mockReturnValue(NOW + 61_000);
      await waitForTick();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();
    });

    it("keeps the active card while the window is still open", async () => {
      await openWithLeaseEndingAt(ENDS_AT);

      jest.spyOn(Date, "now").mockReturnValue(NOW + 59_000);
      await waitForTick();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();
    });
  });

  describe("the card container", () => {
    const cases: ReadonlyArray<{
      name: string;
      state: Partial<CipherAccessStateView>;
      testId: string;
      glyph: string;
    }> = [
      {
        name: "resting request-access",
        state: {},
        testId: "request",
        glyph: ACCESS_BADGE_LOOK.privileged.icon,
      },
      {
        name: "pending request",
        state: { pendingRequest: requestView() },
        testId: "pending",
        glyph: ACCESS_BADGE_LOOK.pending.icon,
      },
      {
        name: "approved request",
        state: { approvedRequest: requestView() },
        testId: "approved",
        glyph: ACCESS_BADGE_LOOK.ready.icon,
      },
      {
        name: "active lease",
        state: { activeLease: leaseView() },
        testId: "active",
        glyph: ACCESS_BADGE_LOOK.active.icon,
      },
      {
        name: "unavailable",
        state: { badgeState: "unavailable" },
        testId: "unavailable",
        glyph: ACCESS_BADGE_LOOK.unavailable.icon,
      },
    ];

    it.each(cases)(
      "renders $name as a card with an icon tile",
      async ({ state, testId, glyph }) => {
        requestsApi.getCipherAccessState.mockResolvedValue(accessState(state));

        await create(gatedCipher());

        const card = query(`bit-card[data-testid="cipher-view-banner-${testId}"]`);
        expect(card).not.toBeNull();
        expect(card?.querySelector(`bit-icon-tile bit-icon.${glyph}`)).not.toBeNull();
      },
    );
  });

  describe("the rule's terms, before the form is opened", () => {
    const MAX_DURATION = '[data-testid="cipher-view-banner-max-duration"]';

    it("renders the cap alone when the rule needs an approver", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "human", maxDurationSeconds: 4 * 3600 }),
      );

      await create(gatedCipher());

      expect(query(MAX_DURATION)?.textContent?.trim()).toBe(
        "pamRequestAccessBannerMaxDuration 4 hours",
      );
    });

    it("renders the cap with the instant-approval clause when the rule auto-approves", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "automatic", maxDurationSeconds: 86_400 }),
      );

      await create(gatedCipher());

      expect(query(MAX_DURATION)?.textContent?.trim()).toBe(
        "pamRequestAccessBannerMaxDurationAutomatic 1 day",
      );
    });

    it("renders no line when the pre-check resolves no cap", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ maxDurationSeconds: undefined }));

      await create(gatedCipher());

      expect(query(MAX_DURATION)).toBeNull();
      expect(query('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
    });

    it("renders no line, and no error, when the pre-check fails", async () => {
      requestsApi.preCheck.mockRejectedValue(new Error("boom"));

      await create(gatedCipher());

      expect(query(MAX_DURATION)).toBeNull();
      expect(query('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
    });

    it("does not pre-check a cipher whose access is already in play", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView() }),
      );

      await create(gatedCipher());

      expect(requestsApi.preCheck).not.toHaveBeenCalled();
    });
  });

  describe("the inline request form", () => {
    const TOGGLE = "#pam-cipher-view-banner_button_request-toggle";
    const CANCEL = "#pam-cipher-view-banner_button_request-cancel";

    function form(): RequestAccessFormComponent | undefined {
      return fixture.debugElement.query(By.directive(RequestAccessFormComponent))
        ?.componentInstance as RequestAccessFormComponent | undefined;
    }

    /** Opens the form as Request access does, and lets its pre-check land. */
    async function openForm(): Promise<void> {
      query(TOGGLE)?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    beforeEach(async () => {
      await create(gatedCipher());
    });

    it("opens under the request card in place of Request access, without a dialog", async () => {
      await openForm();

      expect(form()).toBeDefined();
      expect(query(TOGGLE)).toBeNull();
      expect(query('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("offers Send request once the pre-check shapes the form", async () => {
      await openForm();

      expect(query("#pam-cipher-view-banner_button_request-submit")).not.toBeNull();
    });

    it("offers only Cancel when the pre-check fails", async () => {
      requestsApi.preCheck.mockRejectedValue(new Error("boom"));
      await openForm();

      expect(query("#pam-cipher-view-banner_button_request-submit")).toBeNull();
      expect(query(CANCEL)).not.toBeNull();
    });

    it("moves focus into the form when it opens", async () => {
      await openForm();

      expect(document.activeElement).toBe(query('[data-testid="request-fold-out"]'));
    });

    it("closes from Cancel and returns focus to Request access", async () => {
      await openForm();

      query(CANCEL)?.click();
      fixture.detectChanges();

      expect(form()).toBeUndefined();
      expect(document.activeElement).toBe(query(TOGGLE));
    });

    it("closes and re-reads the access state when the form reports a change", async () => {
      await openForm();
      requestsApi.getCipherAccessState.mockClear();

      form()!.accessChanged.emit();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(form()).toBeUndefined();
      expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    });

    it("closes when the request card goes away, and stays closed when it returns", async () => {
      await openForm();

      await refreshTo(accessState({ pendingRequest: requestView() }));
      expect(form()).toBeUndefined();

      await refreshTo(accessState());
      expect(form()).toBeUndefined();
      expect(query(TOGGLE)).not.toBeNull();
    });
  });

  describe("the request sheet, in the popup", () => {
    let closed$: Subject<boolean | undefined>;
    let close: jest.Mock;

    /** Opens the sheet as the Request access button does. */
    function openSheet(): void {
      query("#pam-cipher-view-banner_button_request-toggle")?.click();
    }

    beforeEach(async () => {
      usePopupLayout();
      closed$ = new Subject<boolean | undefined>();
      close = jest.fn();
      dialogService.open.mockReturnValue({ closed: closed$, close } as unknown as DialogRef);
      await create(gatedCipher({ name: "Github" }));
      openSheet();
    });

    it("opens with the item", () => {
      expect(dialogService.open).toHaveBeenCalledWith(RequestAccessSheetComponent, {
        data: { cipherId: "cipher-1", itemName: "Github" },
      });
    });

    it("opens one sheet at a time", () => {
      openSheet();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
    });

    it("re-reads the access state when the sheet reports a change", async () => {
      requestsApi.getCipherAccessState.mockClear();

      closed$.next(true);
      await fixture.whenStable();

      expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    });

    it("leaves the state alone when the sheet is dismissed", async () => {
      requestsApi.getCipherAccessState.mockClear();

      closed$.next(undefined);
      await fixture.whenStable();

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("closes the sheet when the request card goes away", async () => {
      await refreshTo(accessState({ pendingRequest: requestView() }));

      expect(close).toHaveBeenCalled();
    });

    it("closes the sheet with the banner", () => {
      fixture.destroy();

      expect(close).toHaveBeenCalled();
    });
  });

  describe("lifecycle actions", () => {
    it("activates an approved request and re-reads the state", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView({ id: "request-9" } as never) }),
      );
      await create(gatedCipher());
      requestsApi.getCipherAccessState.mockClear();

      await component["activateRequest"]();
      await fixture.whenStable();

      expect(requestsApi.activateAccessRequest).toHaveBeenCalledWith("request-9");
      expect(requestsApi.getCipherAccessState).toHaveBeenCalled();
    });

    it("toasts an error when activation fails, leaving the request activatable", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView() }),
      );
      requestsApi.activateAccessRequest.mockRejectedValue(new Error("slot taken"));
      await create(gatedCipher());

      await component["activateRequest"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseError",
      });
    });

    it("maps the server's reason to a client-side i18n key without leaking the raw payload", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView() }),
      );
      requestsApi.activateAccessRequest.mockRejectedValue(
        Object.assign(
          new Error(
            'error in response: status code 409 Conflict: {"object":"error",' +
              '"message":"Another active lease exists for this item. Try again once it ends.",' +
              '"validationErrors":null,"exceptionStackTrace":"   at Bit.Services.Pam' +
              '.OrganizationFeatures.Commands.ActivateAccessRequestCommand.ActivateAsync"}',
          ),
          { name: "AccessRequestError", variant: "Api" },
        ),
      );
      await create(gatedCipher());

      await component["activateRequest"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseErrorSingleActiveAccess",
      });
      const shown = toastService.showToast.mock.calls[0][0].message as string;
      expect(shown).not.toContain("exceptionStackTrace");
      expect(shown).not.toContain("Bit.Services.Pam");
    });

    it("cancels a pending request once confirmed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView({ id: "request-3" } as never) }),
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);
      await create(gatedCipher());

      await component["cancelRequest"]();

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("request-3");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamCancelRequestCanceledToast",
      });
    });

    it("cancels an approved-but-unactivated request too", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView({ id: "request-4" } as never) }),
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);
      await create(gatedCipher());

      await component["cancelRequest"]();

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("request-4");
    });

    it("leaves the request standing when the cancel confirmation is dismissed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView({ id: "request-3" } as never) }),
      );
      dialogService.openSimpleDialog.mockResolvedValue(false);
      await create(gatedCipher());

      await component["cancelRequest"]();

      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
    });

    it("ends an active lease once confirmed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView({ id: "lease-7" } as never) }),
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);
      await create(gatedCipher());

      await component["endLease"]();

      expect(leasesApi.endLease).toHaveBeenCalledWith("lease-7", { reason: undefined });
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamEndLeaseSuccess",
      });
    });

    it("does not end the lease when the confirm is dismissed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(accessState({ activeLease: leaseView() }));
      dialogService.openSimpleDialog.mockResolvedValue(false);
      await create(gatedCipher());

      await component["endLease"]();

      expect(leasesApi.endLease).not.toHaveBeenCalled();
    });

    it("extends the lease with the dialog's request", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          activeLease: leaseView({ id: "lease-8" } as never),
          extensionsAllowed: true,
          maxExtensionDurationSeconds: 3600,
        }),
      );
      const request = { durationSeconds: 3600, reason: "still working" };
      dialogService.open.mockReturnValue({ closed: of(request) } as never);
      leasesApi.extendLease.mockResolvedValue(requestView({ status: "approved" }));
      await create(gatedCipher());

      await component["extendLease"]();

      expect(dialogService.open).toHaveBeenCalledWith(expect.anything(), {
        data: { maxDurationSeconds: 3600 },
      });
      expect(leasesApi.extendLease).toHaveBeenCalledWith("lease-8", request);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamExtendLeaseSuccess",
      });
    });

    it("reports a denied extension as the lease having ended, not as a success", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          activeLease: leaseView({ id: "lease-8" } as never),
          extensionsAllowed: true,
          maxExtensionDurationSeconds: 3600,
        }),
      );
      dialogService.open.mockReturnValue({
        closed: of({ durationSeconds: 3600, reason: "still working" }),
      } as never);
      // The server treats a lease that ran out mid-dialog as a denied request, not a throw.
      leasesApi.extendLease.mockResolvedValue(requestView({ status: "denied" }));
      await create(gatedCipher());

      await component["extendLease"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "warning",
        message: "pamExtendLeaseEnded",
      });
    });

    it("does not extend when the dialog is dismissed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          activeLease: leaseView(),
          extensionsAllowed: true,
          maxExtensionDurationSeconds: 3600,
        }),
      );
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      await create(gatedCipher());

      await component["extendLease"]();

      expect(leasesApi.extendLease).not.toHaveBeenCalled();
    });
  });
});
