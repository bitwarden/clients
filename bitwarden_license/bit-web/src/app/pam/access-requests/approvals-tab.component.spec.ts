import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
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
 * The ids of the once-a-second clocks a spied `setInterval` created, told apart from the
 * zero-delay timers Angular's own scheduler queues during change detection.
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
    decide: jest.Mock;
    revokeLease: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

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
      decide: jest.fn().mockResolvedValue(undefined),
      revokeLease: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [ApprovalsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApproverInboxService, useValue: inbox },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          // Echoes the key (plus any params) rather than a lookup table: the component library asks
          // for keys of its own, and I18nMockService throws on any key it was not given.
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

      expect(query('[data-testid="approvals-loading"]')).not.toBeNull();
      expect(query("bit-skeleton")).toBeNull();

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      const skeleton = query('[data-testid="approvals-loading"]');
      expect(skeleton?.querySelectorAll("bit-skeleton").length).toBeGreaterThan(0);
      expect(skeleton?.querySelector('[role="status"]')?.textContent).toContain("loading");
      expect(query('p[bitTypography="body2"]')).toBeNull();
      expect(query('[data-testid="approvals-empty"]')).toBeNull();
    });

    it("never shows the skeleton when the inbox arrives inside a second", () => {
      inbox.loading$.next(true);

      create();

      jest.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(query('[data-testid="approvals-loading"]')).not.toBeNull();
      expect(query("bit-skeleton")).toBeNull();

      inbox.loading$.next(false);
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
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

    // jsdom performs no layout and loads no stylesheet, so these assert the breakpoint classes on
    // both the header and the cell of each column, not that the buttons are on screen. The 1024px
    // and 1280px behaviour still needs verifying in a browser.
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
        expect(element).not.toBeNull();
        expect(element?.classList).toContain("tw-hidden");
        expect([...(element?.classList ?? [])].filter((c) => c.endsWith(":tw-table-cell"))).toEqual(
          [`${visibleFrom}:tw-table-cell`],
        );
      }
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

      // `bitButton` marks aria-disabled and removes the native attribute, so the button stays
      // focusable for screen readers — which is also why the component guards `decide()` itself.
      expect(query('[data-testid="approvals-approve-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
      expect(query('[data-testid="approvals-deny-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
    });

    it("keeps the filter toolbar on screen when a filter matches nothing", () => {
      // Otherwise there is no way to clear the filter that emptied the table.
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
      // The approve dialog offers "Deny request" and switches in place; recording the requested
      // verdict here would approve a request the approver denied.
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

      component["collectionControl"].setValue("Staging");
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

      component["collectionControl"].setValue("Staging");
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
      // The shared ticker is ref-counted, so a pending-only queue must leave it torn down rather
      // than scheduling a round of change detection every second that can never change anything.
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
});
