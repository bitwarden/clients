import { formatDate } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  LeasingErrorService,
  REQUEST_ACCESS_SERVER_ERRORS,
  toDateInputValue,
} from "..";
import type {
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestView,
  CipherAccessStateView,
} from "../abstractions/access-lease";
import { formatDuration } from "../date/format-duration";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import { DefaultAccessRefreshService } from "../services/default-access-refresh.service";

import { CipherViewBannerComponent } from "./cipher-view-banner.component";
import { REQUEST_WINDOW_ERROR_KEY } from "./request-access-window.validators";

/**
 * The SDK views are wide and every field is server-populated, so tests build only the fields the
 * banner reads and widen through `unknown` — the same convention `my-access.service.spec.ts` uses.
 */
/**
 * Tomorrow, in the shape `<input type="date">` carries. The window validator rejects a window that
 * has already ended (PM-42592), so a date literal would let the cases below pass on the day they
 * were written and fail every day after; anchoring to the real clock keeps them honest. The time of
 * day is then free — any hour tomorrow is still ahead of now.
 */
const futureDate = toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));

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
    // The server resolves both bounds at submit, so every real response carries them; a fixture
    // omitting them would render a window the SDK's own type makes unrepresentable.
    leaseNotBefore: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    leaseNotAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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

/**
 * The badge the SDK would rank for a state assembled from the parts below. Mirrored here — rather
 * than spelled out at every call site — so a fixture built from `activeLease`/`approvedRequest`/
 * `pendingRequest` stays a faithful stand-in for a real response, which always carries both the
 * parts and the ranked badge. The ranking itself is the SDK's, and tested there.
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
    hasActiveLease: false,
    // The SDK resolves both bounds for every pre-check (falling back to the global ones), so they
    // are always present on the wire; a fixture omitting them would leave the duration control
    // empty and every submit path invalid.
    defaultDurationSeconds: 3600,
    maxDurationSeconds: 86_400,
    // The SDK reads an absent canStartLease as true, so the resting fixture is the startable case.
    canStartLease: true,
    ...overrides,
  } as unknown as AccessPreCheckView;
}

describe("CipherViewBannerComponent", () => {
  let fixture: ComponentFixture<CipherViewBannerComponent>;
  let component: CipherViewBannerComponent;
  let enabled$: BehaviorSubject<boolean>;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let leasingErrors: MockProxy<LeasingErrorService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

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
    // The resting pre-check is only reachable once the access-state read has settled, so its
    // resolution lands a cycle after the state it depends on.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function queryAll(selector: string): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as HTMLElement[];
  }

  /**
   * Move the banner to its next access state the way a real change does — announce on
   * {@link AccessRefreshService} and let the re-read drive the template.
   */
  async function refreshTo(next: CipherAccessStateView): Promise<void> {
    requestsApi.getCipherAccessState.mockResolvedValue(next);
    TestBed.inject(AccessRefreshService).notifyAccessChanged("cipher-1");
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function endFieldError(): HTMLElement | null {
    return (query("#pam-cipher-view-banner_input_end")
      ?.closest("bit-form-field")
      ?.querySelector("bit-error") ?? null) as HTMLElement | null;
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    leasingErrors = mock<LeasingErrorService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();

    requestsApi.getCipherAccessState.mockResolvedValue(accessState());
    // The resting banner pre-checks on its own to render the rule's maximum duration, so every
    // test needs a resolved pre-check even when it never opens the form.
    requestsApi.preCheck.mockResolvedValue(preCheck());
    leasingErrors.isLeasingError.mockReturnValue(false);

    // The real fan-out, not a mock: the notify-then-re-read path is the behaviour under test.
    // No push here (NEVER) — the banner's own mutations are what should drive the re-read.
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
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessRefreshService, useValue: accessRefresh },
        // The real shared cancel flow over the same mocks, so the banner's cancel behaviour is
        // still exercised end to end.
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
        { provide: LeasingErrorService, useValue: leasingErrors },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: I18nService, useValue: i18nService },
      ],
    });
  });

  describe("gating", () => {
    it("renders nothing and reads no access state for a cipher that is not PAM-governed", async () => {
      await create(gatedCipher({ partial: false }));

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
      expect(query("bit-card")).toBeNull();
    });

    it("renders nothing when the PAM feature flag is off", async () => {
      enabled$.next(false);

      await create(gatedCipher());

      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
      expect(query("bit-card")).toBeNull();
    });

    it("reads access state for a leaseGated cipher whose partial data is gone", async () => {
      // After a reveal the full cipher has no `partial` flag; `leaseGated` keeps the countdown alive.
      await create(gatedCipher({ partial: false, leaseGated: true }));

      expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
    });

    it("renders nothing when the access-state read fails", async () => {
      requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

      await create(gatedCipher());

      expect(query("bit-card")).toBeNull();
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

    it("states the granted duration from the approved request's own window", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView(grantedWindow(3600)) }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-approved-duration"]')?.textContent).toContain(
        "pamApprovedRequestBannerDuration 1 hour",
      );
    });

    // The human-approval route resolves the window from the requester's chosen start and end,
    // which can sit wholly in the future.
    it("states the granted duration for a window that has not opened yet", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ approvedRequest: requestView(grantedWindow(3 * 3600, 24 * 3600)) }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="cipher-view-banner-approved-duration"]')?.textContent).toContain(
        "pamApprovedRequestBannerDuration 3 hours",
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
      expect(text()).toContain("pamActiveLeaseBannerTitle");
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
  });

  describe("the absolute expiry beside the countdown", () => {
    const NOW = Date.parse("2026-01-01T15:00:00.000Z");
    const ENDS_AT = "2026-01-01T16:15:00.000Z";

    // Pinned rather than faked with timers: the banner's countdown runs on a real `setInterval`,
    // and replacing the timer implementation would stall `fixture.whenStable()`.
    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // Both sides go through this: `formatDate` separates the meridiem with a narrow no-break space,
    // which the template's own whitespace collapse would otherwise leave only on one side.
    function collapseSpace(value: string | null | undefined): string {
      return (value ?? "").replace(/\s+/g, " ").trim();
    }

    function until(iso: string): string {
      return `pamWindowUntil ${formatDate(iso, "short", "en-US")}`;
    }

    // Real time, for the same reason the clock above is pinned rather than faked: the banner's
    // interval is a real one, so a tick can only be observed by outlasting its second.
    function waitForTick(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 1_100));
    }

    it("pairs the active lease's countdown with the wall-clock time it ends", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({ activeLease: leaseView({ notAfter: ENDS_AT }) }),
      );

      await create(gatedCipher());

      expect(text()).toContain("pamActiveLeaseBannerTitle 1h 15m");
      expect(query('[data-testid="active-lease-ends-at"]')?.textContent?.trim()).toBe(
        until(ENDS_AT),
      );
    });

    it("shows the end of the granted window on an approved request already inside its window", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          approvedRequest: requestView({
            leaseNotBefore: "2026-01-01T14:00:00.000Z",
            leaseNotAfter: ENDS_AT,
          }),
        }),
      );

      await create(gatedCipher());

      expect(query('[data-testid="approved-access-window"]')?.textContent?.trim()).toBe(
        until(ENDS_AT),
      );
    });

    it("shows the whole range for an approved request whose window has not opened yet", async () => {
      const STARTS_AT = "2026-01-02T09:00:00.000Z";
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          approvedRequest: requestView({ leaseNotBefore: STARTS_AT, leaseNotAfter: ENDS_AT }),
        }),
      );

      await create(gatedCipher());

      expect(collapseSpace(query('[data-testid="approved-access-window"]')?.textContent)).toBe(
        collapseSpace(
          `${formatDate(STARTS_AT, "short", "en-US")} – ${formatDate(ENDS_AT, "short", "en-US")}`,
        ),
      );
    });

    it("switches an approved request to the opened form once its window arrives", async () => {
      const STARTS_AT = new Date(NOW + 30 * 1000).toISOString();
      requestsApi.getCipherAccessState.mockResolvedValue(
        accessState({
          approvedRequest: requestView({ leaseNotBefore: STARTS_AT, leaseNotAfter: ENDS_AT }),
        }),
      );

      await create(gatedCipher());
      expect(query('[data-testid="approved-access-window"]')?.textContent).not.toContain(
        "pamWindowUntil",
      );

      jest.spyOn(Date, "now").mockReturnValue(NOW + 31 * 1000);
      await waitForTick();
      fixture.detectChanges();

      expect(query('[data-testid="approved-access-window"]')?.textContent?.trim()).toBe(
        until(ENDS_AT),
      );
    });
  });

  describe("the card container", () => {
    const cases: ReadonlyArray<{
      name: string;
      state: Partial<CipherAccessStateView>;
      testId: string;
      glyph: string;
    }> = [
      { name: "resting request-access", state: {}, testId: "request", glyph: "bwi-key" },
      {
        name: "pending request",
        state: { pendingRequest: requestView() },
        testId: "pending",
        glyph: "bwi-clock",
      },
      {
        name: "approved request",
        state: { approvedRequest: requestView() },
        testId: "approved",
        glyph: "bwi-check-circle",
      },
      {
        name: "active lease",
        state: { activeLease: leaseView() },
        testId: "active",
        glyph: "bwi-clock",
      },
    ];

    it.each(cases)(
      "renders $name as a card with an icon tile",
      async ({ state, testId, glyph }) => {
        requestsApi.getCipherAccessState.mockResolvedValue(accessState(state));

        await create(gatedCipher());

        const card = query(`bit-card[data-testid="cipher-view-banner-${testId}"]`);
        expect(card).not.toBeNull();
        expect(card?.querySelector(`bit-icon-tile i.${glyph}`)).not.toBeNull();
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

  describe("the request fold-out", () => {
    it("shapes the form from the pre-check's automatic path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      expect(requestsApi.preCheck).toHaveBeenCalledWith("cipher-1");
      expect(component["requestMode"]()).toBe("automatic");
      expect(query("#pam-cipher-view-banner_select_duration")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_input_date")).toBeNull();
    });

    it("moves Cancel down beside Request access once the form is open", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();
      const cancel = query("#pam-cipher-view-banner_button_request-cancel");
      expect(cancel).not.toBeNull();
      expect(cancel?.closest("div")).toBe(
        query("#pam-cipher-view-banner_button_request-submit")?.closest("div"),
      );
    });

    it("collapses the form from the Cancel beside Request access", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      query("#pam-cipher-view-banner_button_request-cancel")?.click();
      fixture.detectChanges();

      expect(component["requestFormExpanded"]()).toBe(false);
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-cancel")).toBeNull();
    });

    it("still offers Cancel when the pre-check leaves the fold-out without a form", async () => {
      requestsApi.preCheck.mockRejectedValue(new Error("boom"));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      expect(query("#pam-cipher-view-banner_button_request-submit")).toBeNull();
      expect(query('[data-testid="request-error"]')).not.toBeNull();

      query("#pam-cipher-view-banner_button_request-cancel")?.click();
      fixture.detectChanges();

      expect(component["requestFormExpanded"]()).toBe(false);
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();
    });

    it("moves focus into the fold-out when opening unmounts the toggle", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      const focused = document.activeElement as HTMLElement | null;
      expect(focused).not.toBe(document.body);
      expect(focused?.contains(query("#pam-cipher-view-banner_button_request-cancel"))).toBe(true);
      // The move is only announceable if what it lands on names itself.
      expect(focused?.getAttribute("role")).toBe("group");
      expect(focused?.getAttribute("aria-label")?.trim()).toBe("pamRequestAccessButton");
    });

    it("returns focus to the toggle when Cancel unmounts itself", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      query("#pam-cipher-view-banner_button_request-cancel")?.click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(query("#pam-cipher-view-banner_button_request-toggle"));
    });

    it("leaves focus where it is when the toggle remounts on its own", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await component["toggleRequestForm"]();
      fixture.detectChanges();

      const elsewhere = document.createElement("input");
      document.body.appendChild(elsewhere);
      elsewhere.focus();

      // The request is approved and started, so the resting card and its toggle unmount...
      await refreshTo(accessState({ activeLease: leaseView() }));
      expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();

      // ...and the lapsing lease brings both back, with the requester editing somewhere else.
      await refreshTo(accessState());
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();

      expect(document.activeElement).toBe(elsewhere);
      elsewhere.remove();
    });

    it("still moves focus on a toggle made after the banner changed state", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await component["toggleRequestForm"]();
      fixture.detectChanges();

      await refreshTo(accessState({ activeLease: leaseView() }));
      await refreshTo(accessState());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      const focused = document.activeElement as HTMLElement | null;
      expect(focused).not.toBe(document.body);
      expect(focused?.contains(query("#pam-cipher-view-banner_button_request-cancel"))).toBe(true);
    });

    it("drops a toggle's pending focus when the card unmounts before either target renders", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();

      // Cancel in the fold-out, with an access change landing in the same pass: the whole request
      // card unmounts, so neither the toggle nor the fold-out is ever on screen to take the focus.
      await component["toggleRequestForm"]();
      await refreshTo(accessState({ activeLease: leaseView() }));
      expect(query('[data-testid="cipher-view-banner-request"]')).toBeNull();

      const elsewhere = document.createElement("input");
      document.body.appendChild(elsewhere);
      elsewhere.focus();

      await refreshTo(accessState());
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();

      expect(document.activeElement).toBe(elsewhere);
      elsewhere.remove();
    });

    it("does not render the fold-out back open when the card cycles away and returns", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      expect(query("#pam-cipher-view-banner_button_request-submit")).not.toBeNull();

      await refreshTo(accessState({ activeLease: leaseView() }));
      expect(query('[data-testid="cipher-view-banner-request"]')).toBeNull();

      await refreshTo(accessState());

      expect(component["requestFormExpanded"]()).toBe(false);
      expect(query("#pam-cipher-view-banner_button_request-toggle")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_button_request-submit")).toBeNull();
    });

    it("shapes the form from the pre-check's human path and seeds the window", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      expect(component["requestMode"]()).toBe("human");
      expect(query("#pam-cipher-view-banner_input_date")).not.toBeNull();
      expect(component["humanForm"].getRawValue().date).not.toBe("");
      expect(component["humanForm"].getRawValue().start).not.toBe("");
    });

    it("renders the automatic path's Reason field as a multi-line textarea", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      const reason = query("#pam-cipher-view-banner_textarea_automatic-reason");
      expect(reason?.tagName).toBe("TEXTAREA");
      expect(reason?.getAttribute("rows")).toBe("3");
    });

    it("renders the human path's Reason field as a multi-line textarea", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      const reason = query("#pam-cipher-view-banner_textarea_human-reason");
      expect(reason?.tagName).toBe("TEXTAREA");
      expect(reason?.getAttribute("rows")).toBe("3");
    });

    // PM-39858: the picker offered a hardcoded 15m-24h preset list and pre-selected 1h, whatever the
    // governing rule allowed. Both now come from the pre-check's bounds.
    it("narrows the duration picker to the rule's maximum", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({
          approvalMode: "automatic",
          defaultDurationSeconds: 900,
          maxDurationSeconds: 1800,
        }),
      );
      await create(gatedCipher());

      await component["toggleRequestForm"]();
      fixture.detectChanges();

      expect(component["durationOptions"]().map((o) => o.seconds)).toEqual([900, 1800]);
      const rendered = queryAll("#pam-cipher-view-banner_select_duration option").map((o) =>
        o.textContent?.trim(),
      );
      expect(rendered).toHaveLength(2);
    });

    it("pre-selects the rule's default duration rather than a hardcoded hour", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({
          approvalMode: "automatic",
          defaultDurationSeconds: 900,
          maxDurationSeconds: 1800,
        }),
      );
      await create(gatedCipher());

      await component["toggleRequestForm"]();

      expect(component["automaticForm"].getRawValue().durationSeconds).toBe(900);
    });

    it("seeds the human path's window from the rule's default duration", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "human", defaultDurationSeconds: 900, maxDurationSeconds: 1800 }),
      );
      await create(gatedCipher());

      await component["toggleRequestForm"]();

      const { start, end } = component["humanForm"].getRawValue();
      const spanMinutes =
        (Date.parse(`2026-01-01T${end}`) - Date.parse(`2026-01-01T${start}`)) / 60_000;
      expect(spanMinutes).toBe(15);
    });

    it("validates the human path's window against the rule's maximum", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "human", defaultDurationSeconds: 900, maxDurationSeconds: 1800 }),
      );
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await fixture.whenStable();

      // A 2h window is well inside the global 24h ceiling but past this rule's 30m cap.
      component["humanForm"].patchValue({ date: futureDate, start: "09:00", end: "11:00" });
      component["humanForm"].controls.end.markAsTouched();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["humanForm"].invalid).toBe(true);
      const maxWindow = formatDuration("en-US", 1800, "long");
      const error = endFieldError();
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain(maxWindow);
    });

    // PM-42592: a window dated before the request sailed through the form, and the server then
    // persisted a pending request activation could never start.
    it("rejects a window that has already ended", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await fixture.whenStable();

      const pastDate = toDateInputValue(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
      component["humanForm"].patchValue({ date: pastDate, start: "09:00", end: "10:00" });
      component["humanForm"].controls.end.markAsTouched();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["humanForm"].invalid).toBe(true);
      const error = endFieldError();
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("requestAccessModalWindowInPast");
    });

    it("floors the date picker at the day the fold-out opened", async () => {
      // Only an affordance — `min` reports through `ValidityState.rangeUnderflow`, which reactive
      // forms never read, and a typed date skips the picker. The validator above is the guard.
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await fixture.whenStable();

      const date = query("#pam-cipher-view-banner_input_date") as HTMLInputElement | null;
      expect(date?.getAttribute("min")).toBe(toDateInputValue(new Date()));
      // The seeded date is the floor itself, so the form opens valid rather than pre-erroring.
      expect(component["humanForm"].controls.date.value).toBe(date?.getAttribute("min"));
    });

    it("re-resolves the bounds when the fold-out is re-opened against a different rule", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({
          approvalMode: "automatic",
          defaultDurationSeconds: 900,
          maxDurationSeconds: 1800,
        }),
      );
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      await component["toggleRequestForm"]();

      requestsApi.preCheck.mockResolvedValue(
        preCheck({
          approvalMode: "automatic",
          defaultDurationSeconds: 3600,
          maxDurationSeconds: 86_400,
        }),
      );
      await component["toggleRequestForm"]();

      expect(component["automaticForm"].getRawValue().durationSeconds).toBe(3600);
      expect(component["maxWindowSeconds"]()).toBe(86_400);
    });

    it("collapses without asking when the pre-check reports a lease raced in", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ hasActiveLease: true }));
      await create(gatedCipher());

      await component["toggleRequestForm"]();

      expect(component["requestFormExpanded"]()).toBe(false);
      expect(component["requestMode"]()).toBeNull();
    });

    it("surfaces a generic error when the pre-check fails", async () => {
      requestsApi.preCheck.mockRejectedValue(new Error("boom"));
      await create(gatedCipher());

      await component["toggleRequestForm"]();

      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
      expect(component["requestMode"]()).toBeNull();
    });

    describe("when another member holds the single-active-lease slot", () => {
      it("warns with the time the slot frees, in place of the immediate-access copy", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ canStartLease: false, slotFreesAt: "2026-08-31T10:52:00Z" }),
        );
        await create(gatedCipher());

        await component["toggleRequestForm"]();
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain("pamRequestSlotTakenUntil");
        // The "you'll get immediate access" line is a lie while the slot is taken, so it must be
        // replaced rather than stacked on top of.
        expect(text).not.toContain("requestAccessModalAutomaticDescription");
      });

      it("warns without a time when the server does not say when it frees", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ canStartLease: false, slotFreesAt: undefined }),
        );
        await create(gatedCipher());

        await component["toggleRequestForm"]();
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain("pamRequestSlotTaken");
        expect(text).not.toContain("pamRequestSlotTakenUntil");
      });

      it("leaves the form submittable, because contention is a manual retry", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ canStartLease: false, slotFreesAt: "2026-08-31T10:52:00Z" }),
        );
        await create(gatedCipher());

        await component["toggleRequestForm"]();
        fixture.detectChanges();

        // An approved request is still worth holding: it can be started the moment the slot frees.
        expect(query("#pam-cipher-view-banner_select_duration")).not.toBeNull();
        const submit = query("#pam-cipher-view-banner_button_request-submit");
        expect(submit).not.toBeNull();
        expect(submit?.hasAttribute("disabled")).toBe(false);
      });

      it("stays quiet on the human path, whose window is not now", async () => {
        // canStartLease answers about NOW. A requester picking Thursday learns nothing from "taken
        // until 10:52 today", and the spec scopes the warning to an otherwise-auto_approve request.
        requestsApi.preCheck.mockResolvedValue(
          preCheck({
            approvalMode: "human",
            canStartLease: false,
            slotFreesAt: "2026-08-31T10:52:00Z",
          }),
        );
        await create(gatedCipher());

        await component["toggleRequestForm"]();
        fixture.detectChanges();

        expect(component["slotContention"]()).toBeNull();
        const text = fixture.nativeElement.textContent as string;
        expect(text).not.toContain("pamRequestSlotTaken");
        expect(text).toContain("requestAccessModalHumanDescription");
      });

      it("clears the warning when the form is reopened against a freed slot", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ canStartLease: false, slotFreesAt: "2026-08-31T10:52:00Z" }),
        );
        await create(gatedCipher());

        await component["toggleRequestForm"]();
        expect(component["slotContention"]()).not.toBeNull();

        // Collapse, then reopen once the holder is done.
        await component["toggleRequestForm"]();
        requestsApi.preCheck.mockResolvedValue(preCheck({ canStartLease: true }));
        await component["toggleRequestForm"]();
        fixture.detectChanges();

        expect(component["slotContention"]()).toBeNull();
        expect(fixture.nativeElement.textContent).toContain(
          "requestAccessModalAutomaticDescription",
        );
      });
    });
  });

  describe("submitting a request", () => {
    it("sends only a duration on the automatic path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      requestsApi.submitAccessRequest.mockResolvedValue({
        approvalMode: "automatic",
        request: requestView(),
      } as never);
      await create(gatedCipher());
      await component["toggleRequestForm"]();

      component["automaticForm"].patchValue({ durationSeconds: 1800, reason: "  " });
      await component["submitRequest"]();

      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: 1800,
        start: undefined,
        end: undefined,
        // A blank reason is optional on this path and must not be sent as an empty string.
        reason: undefined,
      });
      expect(component["requestFormExpanded"]()).toBe(false);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("sends a window and reason on the human path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      requestsApi.submitAccessRequest.mockResolvedValue({
        approvalMode: "human",
        request: requestView(),
      } as never);
      await create(gatedCipher());
      await component["toggleRequestForm"]();

      component["humanForm"].patchValue({
        date: futureDate,
        start: "09:00",
        end: "10:00",
        reason: " prod incident ",
      });
      await component["submitRequest"]();

      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: undefined,
        start: new Date(`${futureDate}T09:00`).toISOString(),
        end: new Date(`${futureDate}T10:00`).toISOString(),
        reason: "prod incident",
      });
    });

    it("re-checks the window on submit when it elapsed while the form sat open", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();

      const end = component["humanForm"].controls.end;
      component["humanForm"].patchValue({
        date: futureDate,
        start: "09:00",
        end: "10:00",
        reason: "prod incident",
      });
      expect(end.errors).toBeNull();

      // Age the form past its own window without touching a control. Nothing re-runs the validator
      // on its own, so `end` still reads valid — submit is the only thing that can catch this.
      jest.useFakeTimers().setSystemTime(new Date(`${futureDate}T10:00`).getTime() + 1000);
      try {
        expect(end.errors).toBeNull();

        await component["submitRequest"]();

        expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
        expect(end.errors?.[REQUEST_WINDOW_ERROR_KEY]).toEqual(
          expect.objectContaining({ problem: "endInPast" }),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it("does not submit an invalid human form", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();

      component["humanForm"].patchValue({
        date: futureDate,
        start: "10:00",
        end: "09:00",
        reason: "",
      });
      await component["submitRequest"]();

      expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
    });

    it("shows the window error once the requester inverts the window", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].patchValue({ date: futureDate, start: "10:00", end: "09:00" });
      component["humanForm"].controls.end.markAsTouched();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const error = endFieldError();
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("requestAccessModalEndBeforeStart");
      expect(error?.getAttribute("aria-live")).toBe("assertive");
      const endInput = query("#pam-cipher-view-banner_input_end");
      expect(endInput?.getAttribute("aria-invalid")).toBe("true");
    });

    it("reveals the window error when a start edit breaks a window the requester never touched", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].patchValue({ date: futureDate, start: "09:00", end: "10:00" });
      component["humanForm"].controls.start.setValue("11:00");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["humanForm"].controls.end.touched).toBe(true);
      const error = endFieldError();
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("requestAccessModalEndBeforeStart");
    });

    it("clears the window error once the window is valid again", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].patchValue({ date: futureDate, start: "11:00", end: "10:00" });
      component["humanForm"].controls.end.markAsTouched();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].controls.start.setValue("09:00");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["humanForm"].controls.end.errors).toBeNull();
      expect(endFieldError()).toBeNull();
    });

    it("reveals the window error on submit rather than submitting", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].patchValue({
        date: futureDate,
        start: "10:00",
        end: "09:00",
        reason: "prod incident",
      });
      await component["submitRequest"]();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
      const error = endFieldError();
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("requestAccessModalEndBeforeStart");
    });
  });

  describe("reconciling a rejected submit", () => {
    async function submitAndFail(message: string): Promise<void> {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      const error = Object.assign(new Error(message), {
        name: "AccessRequestError",
        variant: "Api",
      });
      leasingErrors.isLeasingError.mockReturnValue(true);
      requestsApi.submitAccessRequest.mockRejectedValue(error);
      await create(gatedCipher());
      await component["toggleRequestForm"]();
      await component["submitRequest"]();
    }

    /** The serialized `ErrorResponseModel` the SDK concatenates onto its transport string. */
    const wireBody = (serverMessage: string, exceptionMessage = serverMessage) =>
      `error in response: status code 400 Bad Request: {"object":"error",` +
      `"message":"${serverMessage}","validationErrors":null,` +
      `"exceptionMessage":"${exceptionMessage}","exceptionStackTrace":null}`;

    it("treats 'already pending' as information, collapsing without an inline error", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.AlreadyPending);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "info",
        message: "requestAccessModalAlreadyPending",
      });
      expect(component["requestFormExpanded"]()).toBe(false);
      expect(component["requestError"]()).toBeNull();
    });

    it("re-reads the access state so the existing state drives the banner", async () => {
      requestsApi.getCipherAccessState.mockClear();
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive);
      await fixture.whenStable();

      expect(requestsApi.getCipherAccessState.mock.calls.length).toBeGreaterThan(1);
    });

    it("echoes a validation failure inline and keeps the fold-out open", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax);

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax);
      expect(component["requestFormExpanded"]()).toBe(true);
    });

    it("classifies on the server's message decoded out of the serialized response", async () => {
      await submitAndFail(wireBody(REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax));

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax);
      expect(component["requestFormExpanded"]()).toBe(true);
    });

    it("ignores a catalog sentence carried elsewhere in the envelope", async () => {
      await submitAndFail(
        wireBody(
          REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax,
          REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive,
        ),
      );

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax);
      expect(component["requestFormExpanded"]()).toBe(true);
    });

    it("pins a missing reason to the reason control", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.ReasonRequired);

      expect(component["humanForm"].controls.reason.errors).toEqual({ required: true });
    });

    it("falls back to generic copy for an unrecognised failure", async () => {
      await submitAndFail("the server exploded");

      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
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
        message: "pamStartLeaseErrorSingleActiveLease",
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
      // The lease ran out while the dialog was open. The server records that as a denied request and
      // answers with it, so the call resolves rather than throwing (PM-42632).
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
        accessState({ activeLease: leaseView(), extensionsAllowed: true }),
      );
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      await create(gatedCipher());

      await component["extendLease"]();

      expect(leasesApi.extendLease).not.toHaveBeenCalled();
    });
  });
});
