import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import type { AccessLeaseId, AccessRequestView } from "../abstractions/access-lease";
import { ApprovalRow, toApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { ManagedLeaseRow, toManagedLeaseRow } from "../approvals/managed-lease-row";

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
  return toApprovalRow(accessRequest(overrides), NAMES, NOW, canDecide);
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

/** Asserts a cell stays hidden below `visibleFrom` and shown from it up, nowhere else. */
function expectVisibleFrom(element: HTMLElement | null, visibleFrom: string): void {
  expect(element).not.toBeNull();
  expect(element?.classList).toContain("tw-hidden");
  expect([...(element?.classList ?? [])].filter((c) => c.endsWith(":tw-table-cell"))).toEqual([
    `${visibleFrom}:tw-table-cell`,
  ]);
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
  let configService: MockProxy<ConfigService>;

  function create(): void {
    fixture = TestBed.createComponent(ApprovalsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
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
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [ApprovalsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApproverInboxService, useValue: inbox },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: ConfigService, useValue: configService },
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
      expect(skeleton?.querySelector("bit-table")?.getAttribute("aria-hidden")).toBe("true");
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

      // A push retries the load, and the service clears the error before the fetch is even sent.
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

    it("renders a row per pending request", () => {
      inbox.inboxRows$.next([row({ id: "req-1" }), row({ id: "req-2" })]);

      create();

      expect(query('[data-testid="approvals-row-req-1"]')).not.toBeNull();
      expect(query('[data-testid="approvals-row-req-2"]')).not.toBeNull();
    });

    it("shows the item, requester, window and reason", () => {
      inbox.inboxRows$.next([row()]);

      create();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("Prod database");
      expect(text).toContain("Grace");
      expect(text).toContain("pamInboxDuration1Hour");
      expect(text).toContain("prod incident");
    });

    // jsdom does no layout; these assert breakpoint classes only, not real 1024px/1280px behavior.
    it.each([
      ["window", "xl"],
      ["reason", "xl"],
      ["submitted", "lg"],
    ] as const)("shows the %s column only from the %s breakpoint up", (column, visibleFrom) => {
      inbox.inboxRows$.next([row({ id: "req-1" })]);

      create();

      for (const element of [
        query(`[data-testid="approvals-col-${column}"]`),
        query(`[data-testid="approvals-cell-${column}-req-1"]`),
      ]) {
        expectVisibleFrom(element, visibleFrom);
      }

      // The skeleton stands in for the table, hiding the same columns at the same widths.
      fixture.destroy();
      inbox.inboxRows$.next([]);
      inbox.loading$.next(true);
      create();
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expectVisibleFrom(query(`[data-testid="approvals-skeleton-col-${column}"]`), visibleFrom);
    });

    it("keeps the actions column visible at every width", () => {
      inbox.inboxRows$.next([row({ id: "req-1" })]);

      create();

      expect(query('[data-testid="approvals-col-actions"]')?.classList).not.toContain("tw-hidden");
      const actionsCell = query('[data-testid="approvals-approve-req-1"]')?.closest("td");
      expect(actionsCell).not.toBeNull();
      expect(actionsCell?.classList).not.toContain("tw-hidden");
    });

    it("links each row to the request detail, which is where a hidden column is read", () => {
      inbox.inboxRows$.next([row({ id: "req-1" })]);

      create();

      expect(query('[data-testid="approvals-row-req-1"] a')?.getAttribute("href")).toBe(
        "/pam/requests/req-1",
      );
    });

    it("carries the exact window and the unclamped reason on title, where those columns show", () => {
      const pending = row({ id: "req-1" });
      inbox.inboxRows$.next([pending]);

      create();

      expect(query('[data-testid="approvals-cell-window-req-1"] span')?.title).toBe(
        pending.exactWindow,
      );
      expect(query('[data-testid="approvals-cell-reason-req-1"] div')?.title).toBe(pending.reason);
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

    it("keeps the filter toolbar on screen when a filter matches nothing", () => {
      // The only way to clear a filter that emptied the table.
      inbox.inboxRows$.next([row()]);
      create();

      component["searchControl"].setValue("nothing matches this");
      fixture.detectChanges();

      expect(query('[data-testid="approvals-no-results"]')).not.toBeNull();
      expect(query("bit-search")).not.toBeNull();
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

      expect(query('[data-testid="approvals-lease-lease-1"]')).not.toBeNull();
      expect(query('[data-testid="approvals-lease-lease-2"]')).not.toBeNull();
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
      expect(query('[data-testid="approvals-lease-lease-1"]')).not.toBeNull();
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

      expect(query('[data-testid="approvals-lease-lease-1"]')).toBeNull();
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

      expect(query('[data-testid="approvals-row-req-1"]')).toBeNull();
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
      expect(query('[data-testid="approvals-lease-lease-1"]')).not.toBeNull();

      jest.advanceTimersByTime(31_000);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-lease-lease-1"]')).toBeNull();
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

  describe("with the VFO1 flag on", () => {
    let viewportWidth: number;
    let mediaListeners: Array<() => void>;

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
        }),
      });
    }

    function resizeTo(width: number): void {
      viewportWidth = width;
      mediaListeners.forEach((notify) => notify());
      fixture.detectChanges();
    }

    function createWithFlag(enabled: boolean): void {
      fixture?.destroy();
      configService.getFeatureFlag$.mockReturnValue(of(enabled));
      create();
    }

    function queryAll(root: ParentNode, selector: string): HTMLElement[] {
      return Array.from(root.querySelectorAll<HTMLElement>(selector));
    }

    function text(element: Element): string {
      return (element.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    function pendingTable(): HTMLElement {
      return queryAll(fixture.nativeElement, "bit-accordion")[0].querySelector(
        "bit-table, bit-table-v2",
      ) as HTMLElement;
    }

    function leaseTable(): HTMLElement {
      return queryAll(fixture.nativeElement, "bit-accordion")[1].querySelector(
        "bit-table, bit-table-v2",
      ) as HTMLElement;
    }

    function headings(table: HTMLElement): string[] {
      return queryAll(table, 'th, [role="columnheader"]').map(text);
    }

    function pendingOrder(): string[] {
      return queryAll(pendingTable(), '[data-testid^="approvals-approve-"]').map((button) =>
        (button.getAttribute("data-testid") ?? "").replace("approvals-approve-", ""),
      );
    }

    beforeEach(() => {
      viewportWidth = 1440;
      mediaListeners = [];
      stubMatchMedia();
    });

    afterEach(() => {
      delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it("renders bit-table-v2 for both sections instead of bit-table", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      createWithFlag(true);

      expect(pendingTable().tagName).toBe("BIT-TABLE-V2");
      expect(leaseTable().tagName).toBe("BIT-TABLE-V2");
      expect(query("bit-table")).toBeNull();
    });

    it("renders the v1 table, and no v2 table, with the flag off", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      createWithFlag(false);

      expect(pendingTable().tagName).toBe("BIT-TABLE");
      expect(leaseTable().tagName).toBe("BIT-TABLE");
      expect(query("bit-table-v2")).toBeNull();
    });

    it("renders the same column headings, in the same order, as the v1 tables", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      createWithFlag(false);
      const v1Pending = headings(pendingTable());
      const v1Leases = headings(leaseTable());

      createWithFlag(true);

      expect(v1Pending).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamInboxWindow",
        "pamInboxReason",
        "pamColumnSubmitted",
        "pamColumnActions",
      ]);
      expect(headings(pendingTable())).toEqual(v1Pending);
      expect(v1Leases).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamColumnWindow",
        "pamColumnRemaining",
        "pamColumnActions",
      ]);
      expect(headings(leaseTable())).toEqual(v1Leases);
    });

    it.each([
      [1100, ["pamColumnItem", "pamInboxRequester", "pamColumnSubmitted", "pamColumnActions"]],
      [800, ["pamColumnItem", "pamInboxRequester", "pamColumnActions"]],
    ])("drops the columns v1 hides below its breakpoints at %ipx", (width, expectedPending) => {
      viewportWidth = width;
      inbox.inboxRows$.next([row({ id: "req-1" })]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      createWithFlag(true);

      expect(headings(pendingTable())).toEqual(expectedPending);
      expect(query('[data-testid="approvals-cell-window-req-1"]')).toBeNull();
      expect(query('[data-testid="approvals-cell-reason-req-1"]')).toBeNull();
      expect(headings(leaseTable())).toEqual([
        "pamColumnItem",
        "pamInboxRequester",
        "pamColumnRemaining",
        "pamColumnActions",
      ]);
    });

    it("renders one row per pending request and per live lease, as v1 does", () => {
      inbox.inboxRows$.next([row({ id: "req-1" }), row({ id: "req-2" }), row({ id: "req-3" })]);
      inbox.activeLeaseRows$.next([
        leaseRow({ producedLeaseId: "lease-1" }),
        leaseRow({ id: "req-4", producedLeaseId: "lease-2" }),
      ]);

      createWithFlag(false);
      const v1PendingRows = queryAll(pendingTable(), "tr[bitRow]").length;
      const v1LeaseRows = queryAll(leaseTable(), "tr[bitRow]").length;

      createWithFlag(true);

      expect(v1PendingRows).toBe(3);
      expect(queryAll(pendingTable(), "bit-row")).toHaveLength(v1PendingRows);
      expect(v1LeaseRows).toBe(2);
      expect(queryAll(leaseTable(), "bit-row")).toHaveLength(v1LeaseRows);
    });

    it("shows the same cell content as v1", () => {
      const pending = row({ id: "req-1" });
      inbox.inboxRows$.next([pending]);
      inbox.activeLeaseRows$.next([
        leaseRow(
          { producedLeaseId: "lease-1" },
          { addedSeconds: 3600, latestEndMs: Date.parse("2026-08-17T14:00:00.000Z") },
        ),
      ]);

      createWithFlag(true);

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

    it("says so explicitly when a request carries no reason", () => {
      inbox.inboxRows$.next([row({ reason: undefined })]);

      createWithFlag(true);

      expect(text(pendingTable())).toContain("pamInboxReasonMissing");
    });

    it("sorts by submitted time, oldest first, by default, as v1 does", () => {
      inbox.inboxRows$.next([
        row({ id: "newest", submittedAt: "2026-08-17T11:50:00.000Z" }),
        row({ id: "oldest", submittedAt: "2026-08-17T10:00:00.000Z" }),
        row({ id: "middle", submittedAt: "2026-08-17T11:00:00.000Z" }),
      ]);

      createWithFlag(false);
      const v1Order = pendingOrder();

      createWithFlag(true);

      expect(v1Order).toEqual(["oldest", "middle", "newest"]);
      expect(pendingOrder()).toEqual(v1Order);
      const submitted = queryAll(pendingTable(), '[role="columnheader"]').find(
        (header) => text(header) === "pamColumnSubmitted",
      );
      expect(submitted?.getAttribute("aria-sort")).toBe("ascending");
    });

    it("keeps the default sort when opened below lg and widened, as v1 does", () => {
      viewportWidth = 800;
      inbox.inboxRows$.next([
        row({ id: "newest", submittedAt: "2026-08-17T11:50:00.000Z" }),
        row({ id: "oldest", submittedAt: "2026-08-17T10:00:00.000Z" }),
      ]);

      createWithFlag(true);
      resizeTo(1440);

      const submitted = queryAll(pendingTable(), '[role="columnheader"]').find(
        (header) => text(header) === "pamColumnSubmitted",
      );
      expect(submitted?.getAttribute("aria-sort")).toBe("ascending");
      expect(pendingOrder()).toEqual(["oldest", "newest"]);
    });

    it("sorts on the same three columns as v1 in each section", () => {
      inbox.inboxRows$.next([row()]);
      inbox.activeLeaseRows$.next([leaseRow()]);

      createWithFlag(true);

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

      createWithFlag(true);

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

      createWithFlag(true);

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

    it("disables both decisions on the caller's own request", () => {
      inbox.inboxRows$.next([row({ id: "mine" }, false)]);

      createWithFlag(true);

      expect(query('[data-testid="approvals-approve-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
      expect(query('[data-testid="approvals-deny-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
    });

    it("opens the decide dialog from the approve and deny buttons", () => {
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      inbox.inboxRows$.next([row({ id: "req-1" })]);

      createWithFlag(true);

      query('[data-testid="approvals-approve-req-1"]')?.click();
      query('[data-testid="approvals-deny-req-1"]')?.click();

      expect(dialogService.open).toHaveBeenCalledTimes(2);
    });

    it("confirms before revoking from the revoke button", () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      inbox.activeLeaseRows$.next([leaseRow()]);

      createWithFlag(true);

      query('[data-testid="approvals-revoke-lease-1"]')?.click();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
    });

    it("applies the toolbar filters to the v2 rows", () => {
      inbox.inboxRows$.next([
        row({ id: "keep" }),
        row({ id: "drop", requesterName: "Someone", requesterEmail: undefined }),
      ]);
      createWithFlag(true);

      component["searchControl"].setValue("grace");
      fixture.detectChanges();

      expect(pendingOrder()).toEqual(["keep"]);
    });

    it("keeps the section empty states outside the table", () => {
      inbox.activeLeaseRows$.next([leaseRow()]);

      createWithFlag(true);

      expect(query('[data-testid="approvals-pending-empty"]')).not.toBeNull();
      expect(queryAll(fixture.nativeElement, "bit-table-v2")).toHaveLength(1);
    });

    it("shows a v2 skeleton, hidden from assistive tech, once loading has run for a second", () => {
      inbox.loading$.next(true);

      createWithFlag(true);
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      const skeleton = query('[data-testid="approvals-loading"]');
      const table = skeleton?.querySelector("bit-table-v2");
      expect(table?.getAttribute("aria-hidden")).toBe("true");
      expect(skeleton?.querySelector("bit-table")).toBeNull();
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
      expect(query('[data-testid="approvals-loading-status"]')?.textContent).toContain("loading");
    });
  });
});
