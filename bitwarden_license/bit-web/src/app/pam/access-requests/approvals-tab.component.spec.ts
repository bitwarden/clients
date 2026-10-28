import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import type { AccessLeaseId, AccessRequestView } from "../abstractions/access-lease";
import { ApprovalRow, toApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { ManagedLeaseRow, toManagedLeaseRow } from "../approvals/managed-lease-row";
import { stubToolbarWidth } from "../testing/toolbar-width";

import { emptyResolvedNames } from "./access-name-resolver.service";
import { ApprovalsTabComponent } from "./approvals-tab.component";

const NOW = new Date("2026-08-17T12:00:00.000Z");

const NAMES = {
  ...emptyResolvedNames(),
  cipherNameById: new Map([["cipher-1", "Prod database"]]),
  collectionNameById: new Map([
    ["col-1", "Production"],
    ["col-2", "Staging"],
  ]),
  organizationNameById: new Map([["org-1", "Meridian Group"]]),
};

function accessRequest(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    reason: "prod incident",
    submittedAt: "2026-08-17T11:30:00.000Z",
    decisions: [],
    requesterName: "Grace",
    requesterEmail: "grace@example.com",
    ...overrides,
  } as unknown as AccessRequestView;
}

function row(overrides: Record<string, unknown> = {}, canDecide = true): ApprovalRow {
  return toApprovalRow(accessRequest(overrides), NAMES, NOW, canDecide, "en-US");
}

function leaseRow(
  overrides: Record<string, unknown> = {},
  extension?: { addedSeconds: number; latestEndMs: number },
): ManagedLeaseRow {
  return toManagedLeaseRow(
    accessRequest({
      status: "approved",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "active",
      ...overrides,
    }) as AccessRequestView & { producedLeaseId: AccessLeaseId },
    NAMES,
    extension,
  );
}

/**
 * The ids of the per-second clocks a spied `setInterval` created, apart from Angular's own
 * zero-delay scheduler timers.
 */
function secondlyIntervalIds(spy: jest.SpyInstance): unknown[] {
  return spy.mock.results
    .filter((_, index) => spy.mock.calls[index][1] === 1000)
    .map((result) => result.value);
}

describe("ApprovalsTabComponent", () => {
  let fixture: ComponentFixture<ApprovalsTabComponent>;
  let component: ApprovalsTabComponent;
  let inbox: {
    inboxRows$: BehaviorSubject<ApprovalRow[]>;
    activeLeaseRows$: BehaviorSubject<ManagedLeaseRow[]>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    decide: jest.Mock;
    revokeLease: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let viewportWidth: number;
  let mediaListeners: Array<() => void>;
  let toolbarWidth: ReturnType<typeof stubToolbarWidth>;

  function create(): void {
    fixture = TestBed.createComponent(ApprovalsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function matchesWidth(query: string): boolean {
    return viewportWidth >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
  }

  /** jsdom has no `matchMedia`; this answers `min-width` queries against `viewportWidth`. */
  function stubMatchMedia(): void {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: matchesWidth(query),
        media: query,
        addEventListener: jest.fn((_type: string, listener: (event: unknown) => void) =>
          mediaListeners.push(() => listener({ matches: matchesWidth(query), media: query })),
        ),
        removeEventListener: jest.fn(),
        // The CDK's high-contrast detector still uses the deprecated listener API.
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }),
    });
  }

  /** Resizes the viewport and the toolbar with it; the toolbar collapses by its own width. */
  function resizeTo(width: number): void {
    viewportWidth = width;
    mediaListeners.forEach((notify) => notify());
    // Runs the after-render hooks first, so the toolbar is observing its width.
    TestBed.tick();
    toolbarWidth.setWidth(width);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    inbox = {
      inboxRows$: new BehaviorSubject<ApprovalRow[]>([]),
      activeLeaseRows$: new BehaviorSubject<ManagedLeaseRow[]>([]),
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      loading$: new BehaviorSubject<boolean>(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
      decide: jest.fn().mockResolvedValue(undefined),
      revokeLease: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    viewportWidth = 1440;
    mediaListeners = [];
    stubMatchMedia();
    toolbarWidth = stubToolbarWidth(viewportWidth);

    await TestBed.configureTestingModule({
      imports: [ApprovalsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApproverInboxService, useValue: inbox },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          // Echoes the key plus params, since I18nMockService throws on any key not given.
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: unknown[]) =>
              [key, ...args.filter((a) => a != null)].join(" "),
          },
        },
      ],
    })
      // Stubs the vault favicon component, which pulls in environment/settings services this test
      // has no interest in.
      .overrideComponent(ApprovalsTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    delete (window as { matchMedia?: unknown }).matchMedia;
    toolbarWidth.restore();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("rendering", () => {
    it("shows the skeleton table once loading has run for a second", () => {
      inbox.loading$.next(true);

      create();

      const status = query('[data-testid="approvals-loading-status"]');
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.getAttribute("aria-live")).toBe("polite");
      expect(status?.textContent?.trim()).toBe("");
      expect(query('[data-testid="approvals-loading"]')).not.toBeNull();
      expect(query("bit-skeleton")).toBeNull();

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      const skeleton = query('[data-testid="approvals-loading"]');
      expect(skeleton?.querySelectorAll("bit-skeleton").length).toBeGreaterThan(0);
      expect(skeleton?.querySelector("bit-table-v2")?.getAttribute("aria-hidden")).toBe("true");
      expect(query('[data-testid="approvals-loading-status"]')).toBe(status);
      expect(status?.textContent).toContain("loading");
      expect(query('p[bitTypography="body2"]')).toBeNull();
      expect(query('[data-testid="approvals-empty"]')).toBeNull();
    });

    it("keeps the skeleton on screen for its minimum display time", () => {
      inbox.loading$.next(true);

      create();

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query("bit-skeleton")).not.toBeNull();

      inbox.loading$.next(false);
      jest.advanceTimersByTime(300);
      fixture.detectChanges();

      expect(query("bit-skeleton")).not.toBeNull();

      jest.advanceTimersByTime(700);
      fixture.detectChanges();

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="approvals-loading"]')).toBeNull();
      expect(query('[data-testid="approvals-loading-status"]')?.textContent).toContain(
        "pamApprovalsLoaded",
      );
      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
    });

    it("never shows the skeleton when the inbox arrives inside a second", () => {
      inbox.loading$.next(true);

      create();

      jest.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading"]')).not.toBeNull();
      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="approvals-loading-status"]')?.textContent?.trim()).toBe("");

      inbox.loading$.next(false);
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="approvals-loading-status"]')?.textContent?.trim()).toBe("");
      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
    });

    it("leaves the empty state up while an already-loaded empty inbox reloads", () => {
      // PAM pushes on every managed-request change, so blanking the panel each reload would
      // flicker an empty inbox.
      create();

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();

      inbox.loading$.next(true);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
      expect(query('[data-testid="approvals-loading"]')).toBeNull();

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-empty"]')).toBeNull();
      expect(query("bit-skeleton")).not.toBeNull();
    });

    it("does not announce a load that failed as loaded", () => {
      inbox.loading$.next(true);

      create();

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading-status"]')?.textContent).toContain("loading");

      inbox.loadError$.next(new Error("boom"));
      inbox.loading$.next(false);
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="approvals-loading-status"]')?.textContent?.trim()).toBe("");
    });

    it("does not announce a retry of a failed load as loaded while it is still in flight", () => {
      inbox.loading$.next(true);

      create();

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      inbox.loadError$.next(new Error("boom"));
      inbox.loading$.next(false);
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading-status"]')?.textContent?.trim()).toBe("");

      // A push retries the load, and the service clears the error before the fetch is sent.
      inbox.loading$.next(true);
      inbox.loadError$.next(null);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading-status"]')?.textContent?.trim()).toBe("");

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading-status"]')?.textContent).toContain("loading");

      inbox.loading$.next(false);
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading-status"]')?.textContent).toContain(
        "pamApprovalsLoaded",
      );
    });

    it("does not announce a reload that shows no skeleton as loaded", () => {
      inbox.loading$.next(true);

      create();

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      inbox.loading$.next(false);
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading-status"]')?.textContent).toContain(
        "pamApprovalsLoaded",
      );

      inbox.loading$.next(true);
      fixture.detectChanges();
      jest.advanceTimersByTime(500);
      inbox.loading$.next(false);
      jest.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="approvals-loading-status"]')?.textContent?.trim()).toBe("");
    });

    it("shows the empty state when there is nothing to approve", () => {
      create();

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
    });

    it("says so explicitly when a request carries no reason", () => {
      inbox.inboxRows$.next([row({ reason: undefined })]);

      create();

      expect(fixture.nativeElement.textContent).toContain("pamInboxReasonMissing");
    });

    it("disables both decisions on the caller's own request", () => {
      inbox.inboxRows$.next([row({ id: "mine" }, false)]);

      create();

      // `bitButton` marks aria-disabled and keeps the native attribute off, so the button stays
      // focusable for screen readers.
      expect(query('[data-testid="approvals-approve-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
      expect(query('[data-testid="approvals-deny-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
    });

    it("filters by search term across item, collection and requester", () => {
      inbox.inboxRows$.next([
        row({ id: "keep" }),
        row({ id: "drop", requesterName: "Someone", requesterEmail: undefined }),
      ]);
      create();

      component["searchControl"].setValue("grace");
      fixture.detectChanges();

      expect(component["rows"]().map((r) => r.id)).toEqual(["keep"]);
    });
  });

  describe("deciding", () => {
    beforeEach(() => {
      inbox.inboxRows$.next([row({ id: "req-1" })]);
    });

    it("records an approval once confirmed, and toasts", async () => {
      dialogService.open.mockReturnValue({
        closed: of({ confirmed: true, verdict: "approve", comment: "fine" }),
      } as never);
      create();

      await component["decide"](component["rows"]()[0], "approve");

      expect(inbox.decide).toHaveBeenCalledWith("req-1", "approve", "fine");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("records the verdict the dialog closed with, not the one it was opened on", async () => {
      // The approve dialog offers "Deny request" and switches in place.
      dialogService.open.mockReturnValue({
        closed: of({ confirmed: true, verdict: "deny", comment: "wrong window" }),
      } as never);
      create();

      await component["decide"](component["rows"]()[0], "approve");

      expect(inbox.decide).toHaveBeenCalledWith("req-1", "deny", "wrong window");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxDeniedToast",
      });
    });

    it("does nothing when the dialog is dismissed", async () => {
      // Cancel, the header X, Escape and a backdrop click all close with undefined.
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      create();

      await component["decide"](component["rows"]()[0], "approve");

      expect(inbox.decide).not.toHaveBeenCalled();
    });

    it("toasts an error when recording the decision fails", async () => {
      dialogService.open.mockReturnValue({
        closed: of({ confirmed: true, verdict: "deny", comment: undefined }),
      } as never);
      inbox.decide.mockRejectedValue(new Error("boom"));
      create();

      await component["decide"](component["rows"]()[0], "deny");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxDecisionFailed",
      });
    });

    it("never opens the dialog for the caller's own request", async () => {
      inbox.inboxRows$.next([row({ id: "mine" }, false)]);
      create();

      await component["decide"](component["rows"]()[0], "approve");

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(inbox.decide).not.toHaveBeenCalled();
    });
  });

  describe("active access", () => {
    it("renders a row per live lease, with the holder and the item on it", () => {
      inbox.activeLeaseRows$.next([
        leaseRow({ producedLeaseId: "lease-1" }),
        leaseRow(
          { id: "req-2", producedLeaseId: "lease-2", requesterName: "Alan" },
          {
            addedSeconds: 3600,
            latestEndMs: Date.parse("2026-08-17T14:00:00.000Z"),
          },
        ),
      ]);

      create();

      expect(query('[data-testid="approvals-lease-cell-item-lease-1"]')).not.toBeNull();
      expect(query('[data-testid="approvals-lease-cell-item-lease-2"]')).not.toBeNull();
      expect(query('[data-testid="approvals-lease-extended-lease-2"]')).not.toBeNull();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("Prod database");
      expect(text).toContain("Grace");
      expect(text).toContain("Alan");
    });

    it("shows both sections when there is live access but nothing pending", () => {
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      expect(query('[data-testid="approvals-empty"]')).toBeNull();
      expect(query("bit-accordion-group")).not.toBeNull();
      expect(query('[data-testid="approvals-pending-empty"]')).not.toBeNull();
      expect(query('[data-testid="approvals-lease-cell-item-lease-1"]')).not.toBeNull();
    });

    it("still renders the section, empty, when there is nothing live but something pending", () => {
      inbox.inboxRows$.next([row()]);

      create();

      expect(query("bit-accordion-group")).not.toBeNull();
      expect(query('[data-testid="approvals-active-access-empty"]')).not.toBeNull();
      expect(query('[data-testid="approvals-empty"]')).toBeNull();
    });

    it("does not claim there is no active access when a filter hid the live rows", () => {
      inbox.inboxRows$.next([row({ id: "req-pending", collectionId: "col-2" })]);
      inbox.activeLeaseRows$.next([leaseRow()]);
      create();

      component["collectionFilterMenu"]()?.setValue("Staging");
      fixture.detectChanges();

      expect(query('[data-testid="approvals-lease-cell-item-lease-1"]')).toBeNull();
      expect(query('[data-testid="approvals-active-access-empty"]')?.textContent).toContain(
        "pamApprovalsNoResults",
      );
    });

    it("does not claim there is nothing to decide when a filter hid the pending rows", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow({ id: "req-live", collectionId: "col-2" })]);
      create();

      component["collectionFilterMenu"]()?.setValue("Staging");
      fixture.detectChanges();

      expect(query('[data-testid="approvals-cell-item-req-1"]')).toBeNull();
      expect(query('[data-testid="approvals-pending-empty"]')?.textContent).toContain(
        "pamApprovalsNoResults",
      );
    });

    it("shows the inbox-zero empty state only when both sections are empty", () => {
      create();

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
      expect(query("bit-accordion-group")).toBeNull();
    });

    it("stops listing a lease once its window closes, with no server push", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow({ leaseNotAfter: "2026-08-17T12:00:30.000Z" })]);
      create();
      expect(query('[data-testid="approvals-lease-cell-item-lease-1"]')).not.toBeNull();

      jest.advanceTimersByTime(31_000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-lease-cell-item-lease-1"]')).toBeNull();
      expect(query('[data-testid="approvals-active-access-empty"]')).not.toBeNull();
    });

    it("runs no clock at all when there is no lease to expire", () => {
      // The shared ticker is ref-counted, so a pending-only queue leaves it torn down.
      const setIntervalSpy = jest.spyOn(global, "setInterval");
      inbox.inboxRows$.next([row()]);

      create();

      expect(secondlyIntervalIds(setIntervalSpy)).toHaveLength(0);
    });

    it("shares one clock with the badges it renders, and tears it down on destroy", () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
      inbox.activeLeaseRows$.next([
        leaseRow(),
        leaseRow({ id: "req-2", producedLeaseId: "lease-2" }),
      ]);

      create();

      const [intervalId] = secondlyIntervalIds(setIntervalSpy);
      expect(secondlyIntervalIds(setIntervalSpy)).toHaveLength(1);
      expect(clearIntervalSpy).not.toHaveBeenCalledWith(intervalId);

      fixture.destroy();

      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });

    it("revokes the lease once confirmed, and toasts", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      inbox.activeLeaseRows$.next([leaseRow()]);
      create();

      await component["revoke"](component["leaseRows"]()[0]);

      expect(inbox.revokeLease).toHaveBeenCalledWith("req-1", "lease-1");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("does nothing when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      inbox.activeLeaseRows$.next([leaseRow()]);
      create();

      await component["revoke"](component["leaseRows"]()[0]);

      expect(inbox.revokeLease).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("toasts an error when the revoke fails", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      inbox.revokeLease.mockRejectedValue(new Error("boom"));
      inbox.activeLeaseRows$.next([leaseRow()]);
      create();

      await component["revoke"](component["leaseRows"]()[0]);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxRevokeFailed",
      });
    });
  });

  describe("tables", () => {
    function queryAll(root: ParentNode, selector: string): HTMLElement[] {
      return Array.from(root.querySelectorAll<HTMLElement>(selector));
    }

    function text(element: Element): string {
      return (element.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    function pendingTable(): HTMLElement {
      return queryAll(fixture.nativeElement, "bit-accordion")[0].querySelector(
        "bit-table-v2",
      ) as HTMLElement;
    }

    function leaseTable(): HTMLElement {
      return queryAll(fixture.nativeElement, "bit-accordion")[1].querySelector(
        "bit-table-v2",
      ) as HTMLElement;
    }

    function headings(table: HTMLElement): string[] {
      return queryAll(table, '[role="columnheader"]').map(text);
    }

    function pendingOrder(): string[] {
      return queryAll(pendingTable(), '[data-testid^="approvals-approve-"]').map((button) =>
        (button.getAttribute("data-testid") ?? "").replace("approvals-approve-", ""),
      );
    }

    it("renders bit-table-v2 for both sections", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      expect(pendingTable().tagName).toBe("BIT-TABLE-V2");
      expect(leaseTable().tagName).toBe("BIT-TABLE-V2");
    });

    it("renders each section's column headings in order", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      expect(headings(pendingTable())).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamInboxWindow",
        "pamInboxReason",
        "pamColumnSubmitted",
        "pamColumnActions",
      ]);
      expect(headings(leaseTable())).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamColumnWindow",
        "pamColumnRemaining",
        "pamColumnActions",
      ]);
    });

    it.each([
      [1100, ["pamColumnItem", "pamInboxRequester", "pamColumnSubmitted", "pamColumnActions"]],
      [800, ["pamColumnItem", "pamInboxRequester", "pamColumnActions"]],
    ])(
      "drops the window, reason and submitted columns below their breakpoints at %ipx",
      (width, expectedPending) => {
        viewportWidth = width;
        inbox.inboxRows$.next([row({ id: "req-1" })]);
        inbox.activeLeaseRows$.next([leaseRow()]);

        create();

        expect(headings(pendingTable())).toEqual(expectedPending);
        expect(query('[data-testid="approvals-cell-window-req-1"]')).toBeNull();
        expect(query('[data-testid="approvals-cell-reason-req-1"]')).toBeNull();
        expect(headings(leaseTable())).toEqual([
          "pamColumnItem",
          "pamInboxRequester",
          "pamColumnRemaining",
          "pamColumnActions",
        ]);
      },
    );

    it("renders one row per pending request and per live lease", () => {
      inbox.inboxRows$.next([row({ id: "req-1" }), row({ id: "req-2" }), row({ id: "req-3" })]);
      inbox.activeLeaseRows$.next([
        leaseRow({ producedLeaseId: "lease-1" }),
        leaseRow({ id: "req-4", producedLeaseId: "lease-2" }),
      ]);

      create();

      expect(queryAll(pendingTable(), "bit-row")).toHaveLength(3);
      expect(queryAll(leaseTable(), "bit-row")).toHaveLength(2);
    });

    it("shows each row's item, requester, window, reason and lease state", () => {
      const pending = row({ id: "req-1" });
      inbox.inboxRows$.next([pending]);
      inbox.activeLeaseRows$.next([
        leaseRow(
          { producedLeaseId: "lease-1" },
          { addedSeconds: 3600, latestEndMs: Date.parse("2026-08-17T14:00:00.000Z") },
        ),
      ]);

      create();

      const pendingText = text(pendingTable());
      expect(pendingText).toContain("Prod database");
      expect(pendingText).toContain("pamInboxInCollection Production");
      expect(pendingText).toContain("Grace");
      expect(pendingText).toContain("grace@example.com");
      expect(pendingText).toContain("pamInboxDuration1Hour");
      expect(pendingText).toContain("prod incident");
      expect(query('[data-testid="approvals-cell-item-req-1"] a')?.getAttribute("href")).toBe(
        "/pam/requests/req-1",
      );
      expect(query('[data-testid="approvals-cell-window-req-1"] span')?.title).toBe(
        pending.exactWindow,
      );
      expect(query('[data-testid="approvals-cell-reason-req-1"] [title]')?.title).toBe(
        pending.reason,
      );
      expect(query('[data-testid="approvals-lease-extended-lease-1"]')).not.toBeNull();
      expect(leaseTable().querySelector("app-pam-access-state-badge")).not.toBeNull();
    });

    it("sorts by submitted time, oldest first, by default", () => {
      inbox.inboxRows$.next([
        row({ id: "newest", submittedAt: "2026-08-17T11:50:00.000Z" }),
        row({ id: "oldest", submittedAt: "2026-08-17T10:00:00.000Z" }),
        row({ id: "middle", submittedAt: "2026-08-17T11:00:00.000Z" }),
      ]);

      create();

      expect(pendingOrder()).toEqual(["oldest", "middle", "newest"]);
      const submitted = queryAll(pendingTable(), '[role="columnheader"]').find(
        (header) => text(header) === "pamColumnSubmitted",
      );
      expect(submitted?.getAttribute("aria-sort")).toBe("ascending");
    });

    it("keeps the default sort when opened below lg and widened", () => {
      viewportWidth = 800;
      inbox.inboxRows$.next([
        row({ id: "newest", submittedAt: "2026-08-17T11:50:00.000Z" }),
        row({ id: "oldest", submittedAt: "2026-08-17T10:00:00.000Z" }),
      ]);

      create();
      resizeTo(1440);

      const submitted = queryAll(pendingTable(), '[role="columnheader"]').find(
        (header) => text(header) === "pamColumnSubmitted",
      );
      expect(submitted?.getAttribute("aria-sort")).toBe("ascending");
      expect(pendingOrder()).toEqual(["oldest", "newest"]);
    });

    it("sorts on three columns in each section", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      const sortable = (table: HTMLElement) =>
        queryAll(table, '[role="columnheader"]')
          .filter((header) => header.querySelector("button") != null)
          .map(text);
      expect(sortable(pendingTable())).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamColumnSubmitted",
      ]);
      expect(sortable(leaseTable())).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamColumnRemaining",
      ]);
    });

    it("re-sorts by item when its header is clicked", () => {
      inbox.inboxRows$.next([
        row({ id: "b", cipherId: "cipher-b" }),
        row({ id: "a", cipherId: "cipher-a" }),
      ]);

      create();

      const itemSort = queryAll(pendingTable(), '[role="columnheader"] button').find(
        (button) => text(button) === "pamColumnItem",
      );
      itemSort?.click();
      fixture.detectChanges();

      expect(pendingOrder()).toEqual(["a", "b"]);
    });

    it("offers approve then deny on each pending row, and revoke on each lease", () => {
      inbox.inboxRows$.next([row({ id: "req-1" })]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      expect(
        queryAll(
          query('[data-testid="approvals-cell-actions-req-1"]') as HTMLElement,
          "button",
        ).map(text),
      ).toEqual(["pamInboxApprove", "pamInboxDeny"]);
      expect(text(query('[data-testid="approvals-revoke-lease-1"]') as HTMLElement)).toBe(
        "pamInboxRevoke",
      );
    });

    it("opens the decide dialog from the approve and deny buttons", () => {
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      inbox.inboxRows$.next([row({ id: "req-1" })]);

      create();

      query('[data-testid="approvals-approve-req-1"]')?.click();
      query('[data-testid="approvals-deny-req-1"]')?.click();

      expect(dialogService.open).toHaveBeenCalledTimes(2);
    });

    it("confirms before revoking from the revoke button", () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      query('[data-testid="approvals-revoke-lease-1"]')?.click();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
    });

    it("applies the toolbar search to the pending rows", () => {
      inbox.inboxRows$.next([
        row({ id: "keep" }),
        row({ id: "drop", requesterName: "Someone", requesterEmail: undefined }),
      ]);
      create();

      component["searchControl"].setValue("grace");
      fixture.detectChanges();

      expect(pendingOrder()).toEqual(["keep"]);
    });

    it("keeps the pending empty state inside its table, and the lease one outside", () => {
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      const pendingEmpty = query('[data-testid="approvals-pending-empty"]');
      expect(pendingEmpty?.closest("bit-table-v2")).toBe(pendingTable());
      expect(query('[data-testid="approvals-active-access-empty"]')).toBeNull();
      expect(queryAll(fixture.nativeElement, "bit-table-v2")).toHaveLength(2);
    });

    it("shows five skeleton rows under every column heading", () => {
      inbox.loading$.next(true);

      create();
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      const skeleton = query('[data-testid="approvals-loading"]');
      const table = skeleton?.querySelector("bit-table-v2");
      expect(queryAll(table as HTMLElement, "bit-row")).toHaveLength(5);
      expect(skeleton?.querySelectorAll("bit-skeleton").length).toBeGreaterThan(0);
      expect(headings(table as HTMLElement)).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamInboxWindow",
        "pamInboxReason",
        "pamColumnSubmitted",
        "pamColumnActions",
      ]);
    });

    describe("toolbar", () => {
      function chips(root: ParentNode): HTMLElement[] {
        return queryAll(root, "bit-filter-menu");
      }

      /** The toolbar's chip row, which collapses into the filter dialog below md. */
      function filterRow(): HTMLElement {
        return query("bit-table-toolbar [bitOverflowList]") as HTMLElement;
      }

      function optionLabels(chip: HTMLElement): string[] {
        return queryAll(chip, "bit-filter-option").map(text);
      }

      function searchPlaceholder(): string | null | undefined {
        return query("bit-search input")?.getAttribute("placeholder");
      }

      function leaseIds(): string[] {
        return queryAll(fixture.nativeElement, '[data-testid^="approvals-revoke-"]').map((button) =>
          (button.getAttribute("data-testid") ?? "").replace("approvals-revoke-", ""),
        );
      }

      /** Two collections and two requesters across both sections, so either chip can narrow. */
      function twoOfEach(): void {
        inbox.inboxRows$.next([
          row({ id: "prod-grace" }),
          row({
            id: "staging-alan",
            collectionId: "col-2",
            requesterName: "Alan",
            requesterEmail: "alan@example.com",
          }),
        ]);
        inbox.activeLeaseRows$.next([
          leaseRow({ id: "req-live-1", producedLeaseId: "lease-prod" }),
          leaseRow({
            id: "req-live-2",
            producedLeaseId: "lease-staging",
            collectionId: "col-2",
            requesterName: "Alan",
            requesterEmail: "alan@example.com",
          }),
        ]);
      }

      it("projects the search and both filter chips into bit-table-toolbar", () => {
        inbox.inboxRows$.next([row()]);

        create();

        const toolbar = query("bit-table-toolbar");
        expect(toolbar).not.toBeNull();
        expect(toolbar?.querySelector("bit-search")).not.toBeNull();
        expect(chips(toolbar as HTMLElement)).toHaveLength(2);
        expect(queryAll(fixture.nativeElement, "bit-search")).toHaveLength(1);
        expect(chips(fixture.nativeElement)).toHaveLength(2);
      });

      it("renders the search placeholder and id", () => {
        inbox.inboxRows$.next([row()]);

        create();

        expect(searchPlaceholder()).toBe("pamApprovalsSearchPlaceholder");
        expect(query("bit-search")?.getAttribute("id")).toBe("pam-approvals_input_search");
      });

      it("renders both chips' keys, labels and options", () => {
        twoOfEach();

        create();

        const [collectionChip, requesterChip] = chips(fixture.nativeElement);
        expect([optionLabels(collectionChip), optionLabels(requesterChip)]).toEqual([
          ["Production", "Staging"],
          ["Alan", "Grace"],
        ]);
        expect(text(collectionChip)).toContain("pamApprovalsCollectionFilter");
        expect(text(requesterChip)).toContain("pamApprovalsRequesterFilter");
        expect([
          component["collectionFilterMenu"]()?.key(),
          component["requesterFilterMenu"]()?.key(),
        ]).toEqual(["collection", "requester"]);
      });

      it("starts with both chips unset", () => {
        twoOfEach();

        create();

        expect(component["collectionFilterMenu"]()?.active()).toBe(false);
        expect(component["requesterFilterMenu"]()?.active()).toBe(false);
        expect(pendingOrder()).toEqual(["prod-grace", "staging-alan"]);
        expect(leaseIds()).toEqual(["lease-prod", "lease-staging"]);
      });

      it("narrows both sections from the collection chip", () => {
        twoOfEach();
        create();

        component["collectionFilterMenu"]()?.setValue("Staging");
        fixture.detectChanges();

        expect(pendingOrder()).toEqual(["staging-alan"]);
        expect(leaseIds()).toEqual(["lease-staging"]);
      });

      it("narrows both sections from the requester chip", () => {
        twoOfEach();
        create();

        component["requesterFilterMenu"]()?.setValue("Grace");
        fixture.detectChanges();

        expect(pendingOrder()).toEqual(["prod-grace"]);
        expect(leaseIds()).toEqual(["lease-prod"]);
      });

      it("intersects the chips with the search term", () => {
        twoOfEach();
        create();

        // Either control alone leaves rows; together they must leave none.
        component["collectionFilterMenu"]()?.setValue("Production");
        component["searchControl"].setValue("alan");
        fixture.detectChanges();

        expect(pendingOrder()).toEqual([]);
        expect(leaseIds()).toEqual([]);
        expect(query('[data-testid="approvals-pending-empty"]')?.textContent).toContain(
          "pamApprovalsNoResults",
        );
        expect(query('[data-testid="approvals-active-access-empty"]')?.textContent).toContain(
          "pamApprovalsNoResults",
        );
      });

      it("narrows both sections from the search box", () => {
        twoOfEach();
        create();

        component["searchControl"].setValue("staging");
        fixture.detectChanges();

        expect(pendingOrder()).toEqual(["staging-alan"]);
        expect(leaseIds()).toEqual(["lease-staging"]);
      });

      it("keeps the toolbar on screen when a filter matches nothing", () => {
        // The only way to clear a filter that emptied both sections.
        twoOfEach();
        create();

        component["searchControl"].setValue("nothing matches this");
        fixture.detectChanges();

        expect(query('[data-testid="approvals-pending-empty"]')?.textContent).toContain(
          "pamApprovalsNoResults",
        );
        expect(query("bit-table-toolbar bit-search")).not.toBeNull();
        expect(chips(query("bit-table-toolbar") as HTMLElement)).toHaveLength(2);
      });

      it("projects the toolbar into the pending table, which holds its place when emptied", () => {
        twoOfEach();
        create();

        component["requesterFilterMenu"]()?.setValue("Alan");
        component["searchControl"].setValue("nothing matches this");
        fixture.detectChanges();

        const toolbar = query("bit-table-toolbar") as HTMLElement;
        expect(toolbar.closest("bit-table-v2")).toBe(pendingTable());
        expect(pendingOrder()).toEqual([]);
        expect(query('[data-testid="approvals-pending-empty"]')).not.toBeNull();
        expect(chips(toolbar)).toHaveLength(2);
      });

      it("counts a chip's options against the pending rows the other chips leave", () => {
        twoOfEach();
        create();

        const table = fixture.debugElement.query(By.css("bit-table-v2")).componentInstance as {
          optionCount(key: string, value: unknown): number | undefined;
        };
        expect(table.optionCount("requester", "Alan")).toBe(1);

        component["collectionFilterMenu"]()?.setValue("Production");
        fixture.detectChanges();

        expect(table.optionCount("requester", "Alan")).toBe(0);
        expect(pendingOrder()).toEqual(["prod-grace"]);
      });

      it("lays both chips out in the visible filter row at md and up", () => {
        twoOfEach();

        create();

        expect(chips(filterRow())).toHaveLength(2);
        expect(filterRow().classList).not.toContain("tw-invisible");
        expect(query("bit-table-toolbar .bwi-sliders")).toBeNull();
      });

      it("collapses the same chips into the filter dialog trigger below md", () => {
        twoOfEach();
        create();

        resizeTo(500);

        expect(query("bit-table-toolbar .bwi-sliders")).not.toBeNull();
        // Laid out but invisible, so the overflow list can keep measuring it.
        expect(chips(filterRow())).toHaveLength(2);
        expect(filterRow().classList).toContain("tw-invisible");
      });

      it("clears a collapsed selection from its active-filter chip, re-listing both sections", () => {
        twoOfEach();
        create();
        resizeTo(500);

        component["collectionFilterMenu"]()?.setValue("Staging");
        fixture.detectChanges();

        const applied = queryAll(fixture.nativeElement, "bit-table-toolbar bit-chip");
        expect(applied).toHaveLength(1);
        expect(text(applied[0])).toContain("Staging");
        expect(pendingOrder()).toEqual(["staging-alan"]);

        applied[0].querySelector<HTMLElement>("button[bit-chip-dismiss-button]")?.click();
        fixture.detectChanges();

        expect(component["collectionFilterMenu"]()?.active()).toBe(false);
        expect(pendingOrder()).toEqual(["prod-grace", "staging-alan"]);
        expect(leaseIds()).toEqual(["lease-prod", "lease-staging"]);
      });

      it("shows no toolbar while the skeleton is up", () => {
        inbox.loading$.next(true);

        create();
        jest.advanceTimersByTime(1000);
        fixture.detectChanges();

        expect(query('[data-testid="approvals-loading"]')).not.toBeNull();
        expect(query("bit-table-toolbar")).toBeNull();
      });

      it("shows no toolbar over the inbox-zero empty state", () => {
        create();

        expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
        expect(query("bit-table-toolbar")).toBeNull();
      });
    });
  });
});
