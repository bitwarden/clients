import { formatDate } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of, Subject } from "rxjs";

import {
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
} from "@bitwarden/bit-common/pam";
import type {
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestView,
  CipherAccessStateView,
} from "@bitwarden/bit-common/pam";
import { DefaultAccessRefreshService } from "@bitwarden/bit-common/pam/services/default-access-refresh.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { RequestAccessDialogComponent } from "../request-access-dialog/request-access-dialog.component";

import { CipherViewBannerComponent } from "./cipher-view-banner.component";

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
    producedLeaseId: undefined,
    ...overrides,
  } as unknown as AccessRequestView;
}

/**
 * The activation window the server resolves at submit, as an override for {@link requestView}.
 * `startsInSeconds` covers the human-approval route, whose window can open in the future.
 */
function grantedWindow(lengthSeconds: number, startsInSeconds = 0): Partial<AccessRequestView> {
  const startMs = Date.now() + startsInSeconds * 1000;
  return {
    leaseNotBefore: new Date(startMs).toISOString(),
    leaseNotAfter: new Date(startMs + lengthSeconds * 1000).toISOString(),
  } as unknown as Partial<AccessRequestView>;
}

/** The badge the SDK would rank for a state built from the parts below. */
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
    hasActiveLease: false,
    defaultDurationSeconds: 3600,
    maxDurationSeconds: 86_400,
    // The SDK reads an absent canStartLease as true, so the resting fixture is the startable case.
    canStartLease: true,
    ...overrides,
  } as unknown as AccessPreCheckView;
}

const ORGANIZATION_ID = "org-1";

/**
 * A membership as the banner reads it. Goes through the real `Organization` so the licensing
 * predicate under test is the shipped one. Every field is an override, so a case can omit
 * `accessPam` entirely — the un-synced blob the tri-state exists for.
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
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let organizations$: BehaviorSubject<Organization[]>;

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
    // The resting pre-check only resolves after the access-state read settles, landing a cycle later.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    // Licensed by default, so only the licensing tests concern themselves with it.
    organizations$ = new BehaviorSubject<Organization[]>([
      organization({ usePam: true, accessPam: true }),
    ]);

    requestsApi.getCipherAccessState.mockResolvedValue(accessState());
    // The resting banner pre-checks on its own to render the rule's maximum.
    requestsApi.preCheck.mockResolvedValue(preCheck());

    // Real fan-out: notify-then-re-read is under test.
    const accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    });

    TestBed.configureTestingModule({
      imports: [CipherViewBannerComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessRefreshService, useValue: accessRefresh },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
  });

  describe("licensing", () => {
    // The shared `gatedCipher()` leaves organizationId unset, staying focused on the rule.
    function orgGatedCipher(overrides: Partial<CipherView> = {}): CipherView {
      return gatedCipher({ organizationId: ORGANIZATION_ID, ...overrides });
    }

    it("blocks an unlicensed member with an explanation instead of a request button", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
      expect(query("[data-testid='cipher-view-banner-request']")).toBeNull();
      expect(query("#pam-cipher-view-banner_button_request")).toBeNull();
      expect(text()).toContain("pamUnlicensedBannerHeading");
      expect(text()).toContain("pamUnlicensedBannerBody");
      expect(text()).toContain("pamUnlicensedBannerRequestUnavailable");
    });

    it("spends no pre-check on a member who cannot request anything", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);

      await create(orgGatedCipher());

      expect(requestsApi.preCheck).not.toHaveBeenCalled();
    });

    it("offers the request button to a licensed member", async () => {
      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).toBeNull();
      expect(query("[data-testid='cipher-view-banner-request']")).not.toBeNull();
    });

    it("replaces even an active lease with the block, countdown included", async () => {
      organizations$.next([organization({ usePam: true, accessPam: false })]);
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView(), extensionsAllowed: true }),
      );

      await create(orgGatedCipher());

      // The server stops releasing the credential to an unlicensed holder regardless of lease, so a
      // countdown here would narrate access that is no longer being served.
      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
      expect(query("[data-testid='cipher-view-banner-active']")).toBeNull();
      expect(query("[data-testid='active-lease-countdown']")).toBeNull();
      expect(query("#pam-cipher-view-banner_button_extend")).toBeNull();
      expect(query("#pam-cipher-view-banner_button_end")).toBeNull();
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
      // Licensing is tri-state: unknown before `organizations$` emits. Treating unknown as licensed
      // would flash the card and fire its pre-check at someone about to be blocked.
      const pending$ = new Subject<Organization[]>();
      TestBed.overrideProvider(OrganizationService, {
        useValue: { organizations$: () => pending$ },
      });

      await create(orgGatedCipher());

      expect(component["unlicensed"]()).toBeUndefined();
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
      // The block derives from local membership, not the access-state read.
      organizations$.next([organization({ usePam: true, accessPam: false })]);
      requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).not.toBeNull();
    });

    it("does not block a provider user browsing a client organization", async () => {
      // `ProfileProviderOrganizationResponseModel` hardcodes AccessPam=false while still reporting
      // the client org's UsePam.
      organizations$.next([organization({ usePam: true, accessPam: false, isProviderUser: true })]);

      await create(orgGatedCipher());

      expect(query("[data-testid='cipher-view-banner-unlicensed']")).toBeNull();
    });
  });

  describe("gating", () => {
    it("renders nothing and reads no access state for a cipher that is not PAM-governed", async () => {
      await create(gatedCipher({ partial: false }));

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
      expect(query("bit-card")).toBeNull();
      expect(query("bit-section-header")).toBeNull();
    });

    it("renders nothing when the PAM feature flag is off", async () => {
      enabled$.next(false);

      await create(gatedCipher());

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
      expect(query("bit-card")).toBeNull();
      expect(query("bit-section-header")).toBeNull();
    });

    it("reads access state for a leaseGated cipher whose partial data is gone", async () => {
      await create(gatedCipher({ partial: false, leaseGated: true }));

      expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    });

    it("renders nothing when the access-state read fails", async () => {
      requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

      await create(gatedCipher());

      expect(query("bit-card")).toBeNull();
      expect(query("bit-section-header")).toBeNull();
    });
  });

  describe("state rendering", () => {
    it("heads the card with the privileged access section header", async () => {
      await create(gatedCipher());

      const section = query('[data-testid="cipher-view-banner-section"]');
      expect(section?.querySelector("bit-section-header")?.textContent?.trim()).toBe(
        "pamCipherViewSectionHeader",
      );
      expect(section?.querySelector('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
    });

    it("offers Request access for a gated cipher with nothing in play", async () => {
      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_request")).not.toBeNull();
      expect(text()).toContain("pamRequestAccessBannerHeading");
      expect(text()).toContain("pamRequestAccessBannerBody");
    });

    it("offers Cancel request while a request is pending", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView() }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-pending"]')).not.toBeNull();
      expect(text()).toContain("pamPendingRequestBannerHeading");
      expect(query("#pam-cipher-view-banner_button_cancel")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_request")).toBeNull();
    });

    it("offers Start access and Cancel for an approved request", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView() }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-approved"]')).not.toBeNull();
      expect(text()).toContain("pamApprovedRequestBannerHeading");
      expect(query("#pam-cipher-view-banner_button_start")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_cancel-approved")).not.toBeNull();
    });

    it("offers no Start for an approved request that already minted a lease", async () => {
      // Activation is not a status: an activated request stays `approved` and is recognised by its
      // `producedLeaseId`. Offering Start again would be an action the server refuses.
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          approvedRequest: requestView({ producedLeaseId: "lease-5" } as never),
        }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-approved"]')).toBeNull();
      expect(query("#pam-cipher-view-banner_button_start")).toBeNull();
    });

    it("states the granted duration from the approved request's own window", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView(grantedWindow(3600)) }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-approved-duration"]')?.textContent).toContain(
        "pamApprovedRequestBannerDuration 1 hour",
      );
    });

    it("renders no duration line when the window does not resolve to a positive span", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView(grantedWindow(0)) }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-approved"]')).not.toBeNull();
      expect(query('[data-testid="cipher-view-banner-approved-duration"]')).toBeNull();
    });

    it("shows the countdown and End for an active lease, hiding Extend when the rule forbids it", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView(), extensionsAllowed: false }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_end")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_extend")).toBeNull();
      expect(text()).toContain("pamActiveAccessBannerHeading");
    });

    it("offers Extend when the rule allows extensions", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView(), extensionsAllowed: true }),
      );

      await create(gatedCipher());

      expect(query("#pam-cipher-view-banner_button_extend")).not.toBeNull();
    });

    it("prefers an active lease over a pending request", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView(), pendingRequest: requestView() }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();
      expect(query('[data-testid="cipher-view-banner-pending"]')).toBeNull();
    });

    it("re-reads the state on the shared refresh signal", async () => {
      requestsApi.getCipherAccessState
        .mockResolvedValueOnce(accessState({ pendingRequest: requestView() }))
        .mockResolvedValue(accessState({ activeLease: leaseView() }));

      await create(gatedCipher());
      expect(query('[data-testid="cipher-view-banner-pending"]')).not.toBeNull();

      TestBed.inject(AccessRefreshService).notifyAccessChanged("cipher-1");
      await fixture.whenStable();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();
    });
  });

  describe("the absolute window beside the heading", () => {
    const NOW = Date.parse("2026-01-01T15:00:00.000Z");
    const ENDS_AT = "2026-01-01T16:15:00.000Z";

    // `fixture.whenStable()` stalls under fake timers.
    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function collapseSpace(value: string | null | undefined): string {
      return (value ?? "").replace(/\s+/g, " ").trim();
    }

    function until(iso: string): string {
      return `pamWindowUntil ${formatDate(iso, "short", "en-US")}`;
    }

    it("pairs the active lease's countdown with the wall-clock time it ends", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView({ notAfter: ENDS_AT }) }),
      );

      await create(gatedCipher());

      expect(text()).toContain("pamActiveAccessBannerHeading");
      expect(query('[data-testid="access-state-badge-active"]')?.textContent).toContain(
        "pamAccessBadgeTimeLeft 1h 15m",
      );
      expect(collapseSpace(query('[data-testid="active-lease-ends-at"]')?.textContent)).toBe(
        collapseSpace(until(ENDS_AT)),
      );
    });

    it("shows only the end for an approved request already inside its window", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          approvedRequest: requestView({
            leaseNotBefore: "2026-01-01T14:00:00.000Z",
            leaseNotAfter: ENDS_AT,
          }),
        }),
      );

      await create(gatedCipher());

      expect(collapseSpace(query('[data-testid="approved-access-window"]')?.textContent)).toBe(
        collapseSpace(until(ENDS_AT)),
      );
    });

    it("stacks both bounds for an approved request whose window has not opened yet", async () => {
      const STARTS_AT = "2026-01-02T09:00:00.000Z";
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          approvedRequest: requestView({ leaseNotBefore: STARTS_AT, leaseNotAfter: ENDS_AT }),
        }),
      );

      await create(gatedCipher());

      expect(collapseSpace(query('[data-testid="approved-access-window"]')?.textContent)).toBe(
        collapseSpace(`pamWindowFrom ${formatDate(STARTS_AT, "short", "en-US")} ${until(ENDS_AT)}`),
      );
    });
  });

  describe("the five-minute escalation on the active lease", () => {
    const NOW = Date.parse("2026-01-01T15:00:00.000Z");

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

    it("warns and offers both actions inside the threshold", async () => {
      await activeLeaseEndingIn(4 * 60 * 1000);

      expect(query('[data-testid="active-lease-ending-soon"]')?.textContent?.trim()).toBe(
        "pamActiveAccessBannerEndingSoonHeading",
      );
      expect(query('[data-testid="active-lease-countdown"]')).toBeNull();
      expect(query('[data-testid="access-state-badge-ending-soon"]')).not.toBeNull();
      // The warning is only worth showing if it can be acted on from here.
      expect(query("#pam-cipher-view-banner_button_extend")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_end")).not.toBeNull();
    });

    it("warns at exactly five minutes remaining", async () => {
      await activeLeaseEndingIn(5 * 60 * 1000);

      expect(query('[data-testid="active-lease-ending-soon"]')?.textContent?.trim()).toBe(
        "pamActiveAccessBannerEndingSoonHeading",
      );
      expect(query('[data-testid="access-state-badge-ending-soon"]')).not.toBeNull();
    });

    it("rests above the threshold, whatever the lease's total length", async () => {
      await activeLeaseEndingIn(6 * 60 * 1000);

      expect(query('[data-testid="active-lease-countdown"]')?.textContent?.trim()).toBe(
        "pamActiveAccessBannerHeading",
      );
      expect(query('[data-testid="active-lease-ending-soon"]')).toBeNull();
      expect(query('[data-testid="access-state-badge-active"]')).not.toBeNull();
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

    // A fake timer would stall `fixture.whenStable()`.
    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    /** The countdown runs on a real interval; a tick is only observed by outlasting it. */
    function waitForTick(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 1_100));
    }

    async function openWithLeaseEndingAt(iso: string): Promise<void> {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView({ notAfter: iso }) }),
      );
      await create(gatedCipher());
    }

    it("falls back to the resting request card once the window closes", async () => {
      await openWithLeaseEndingAt(ENDS_AT);
      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();

      jest.spyOn(Date, "now").mockReturnValue(NOW + 61_000);
      await waitForTick();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).toBeNull();
      expect(query("#pam-cipher-view-banner_button_extend")).toBeNull();
      expect(query("#pam-cipher-view-banner_button_end")).toBeNull();
      expect(query('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
    });

    it("locks without asking the server again", async () => {
      await openWithLeaseEndingAt(ENDS_AT);
      expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);

      jest.spyOn(Date, "now").mockReturnValue(NOW + 61_000);
      await waitForTick();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).toBeNull();
      expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);
    });

    it("keeps the active card while the window is still open", async () => {
      await openWithLeaseEndingAt(ENDS_AT);

      jest.spyOn(Date, "now").mockReturnValue(NOW + 59_000);
      await waitForTick();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-active"]')).not.toBeNull();
    });
  });

  describe("the rule's terms on the resting card", () => {
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

  describe("the request dialog", () => {
    it("opens for the open cipher, named by the item", async () => {
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      await create(gatedCipher({ name: "Prod database" }));

      query("#pam-cipher-view-banner_button_request")?.click();

      expect(dialogService.open).toHaveBeenCalledWith(RequestAccessDialogComponent, {
        data: { cipherId: "cipher-1", itemName: "Prod database" },
      });
    });

    it("settles into the state the dialog's announcement re-reads", async () => {
      await create(gatedCipher());
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView() }),
      );
      dialogService.open.mockImplementation(() => {
        TestBed.inject(AccessRefreshService).notifyAccessChanged("cipher-1");
        return { closed: of("submitted") } as never;
      });

      query("#pam-cipher-view-banner_button_request")?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(query('[data-testid="cipher-view-banner-pending"]')).not.toBeNull();
      expect(query('[data-testid="cipher-view-banner-request"]')).toBeNull();
    });

    it("re-reads nothing when the dialog is dismissed", async () => {
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      await create(gatedCipher());
      requestsApi.getCipherAccessState.mockClear();

      query("#pam-cipher-view-banner_button_request")?.click();
      await fixture.whenStable();

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
      expect(query('[data-testid="cipher-view-banner-request"]')).not.toBeNull();
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
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamStartLeaseSuccess",
      });
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

    it("toasts the licensing refusal when the seat is withdrawn before Start", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView() }),
      );
      requestsApi.activateAccessRequest.mockRejectedValue(
        Object.assign(new Error("A Privileged Controls license is required to access this item."), {
          name: "AccessRequestError",
          variant: "Api",
        }),
      );
      await create(gatedCipher());

      await component["activateRequest"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamLeaseErrorUnlicensed",
      });
    });

    it("cancels a pending request once confirmed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView({ id: "request-3" } as never) }),
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);
      await create(gatedCipher());

      await component["cancelRequest"]();

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("request-3");
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "pamCancelRequestPendingConfirm" } }),
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamCancelRequestCanceledToast",
      });
    });

    it("cancels an approved-but-unactivated request, warning that approval is given up", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView({ id: "request-4" } as never) }),
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);
      await create(gatedCipher());

      await component["cancelRequest"]();

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("request-4");
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "pamCancelRequestApprovedConfirm" } }),
      );
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

    it("asks nothing when the request was decided between render and click", async () => {
      requestsApi.getCipherAccessState.mockResolvedValueOnce(
        accessState({ pendingRequest: requestView() }),
      );
      await create(gatedCipher());
      // The re-read at click time finds nothing outstanding any more.
      requestsApi.getCipherAccessState.mockResolvedValue(accessState());

      await component["cancelRequest"]();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
    });

    it("does not withdraw a grant the requester activated between render and click", async () => {
      requestsApi.getCipherAccessState.mockResolvedValueOnce(
        accessState({ approvedRequest: requestView({ id: "request-6" } as never) }),
      );
      await create(gatedCipher());
      // Activation leaves the status `approved` and records the lease it minted; the lease governs
      // access from then on, so there is nothing left to withdraw.
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          approvedRequest: requestView({
            id: "request-6",
            producedLeaseId: "lease-6",
          } as never),
        }),
      );

      await component["cancelRequest"]();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
    });

    it("toasts a failed cancel rather than leaving the card silent", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ pendingRequest: requestView() }),
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);
      requestsApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));
      await create(gatedCipher());

      await component["cancelRequest"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pendingStateCancelError",
      });
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
        }),
      );
      const request = { durationSeconds: 3600, reason: "still working" };
      dialogService.open.mockReturnValue({ closed: of(request) } as never);
      leasesApi.extendLease.mockResolvedValue(requestView({ status: "approved" }));
      await create(gatedCipher());

      await component["extendLease"]();

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

    it("toasts the licensing refusal when an extension is refused for the seat", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView(), extensionsAllowed: true }),
      );
      dialogService.open.mockReturnValue({
        closed: of({ durationSeconds: 3600, reason: "still working" }),
      } as never);
      leasesApi.extendLease.mockRejectedValue(
        Object.assign(new Error("A Privileged Controls license is required to access this item."), {
          name: "AccessLeaseError",
          variant: "Api",
        }),
      );
      await create(gatedCipher());

      await component["extendLease"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamLeaseErrorUnlicensed",
      });
    });

    it("does not extend when the dialog is dismissed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView(), extensionsAllowed: true }),
      );
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      await create(gatedCipher());

      await component["extendLease"]();

      expect(leasesApi.extendLease).not.toHaveBeenCalled();
    });
  });
});
