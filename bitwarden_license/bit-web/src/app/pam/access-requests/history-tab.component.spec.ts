import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { HistoryTabComponent } from "./history-tab.component";
import { MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

// Overrides are loosely typed rather than `Partial<MyAccessRequestRow>`: the row's `id` is an opaque
// branded type, so tests stand in plain strings and rely on the single cast below — the same
// convention as `my-access.service.spec.ts`.
function historyRow(overrides: Record<string, unknown> = {}): MyAccessRequestRow {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    cipherName: "Prod database",
    collectionName: "Production",
    status: "denied",
    badgeState: null,
    statusBadge: { labelKey: "pamStatusDenied", variant: "danger" },
    submittedAt: "2026-08-17T11:00:00.000Z",
    resolvedAt: "2026-08-17T11:30:00.000Z",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    resolverLabelKey: null,
    resolverName: "Ada",
    approverComment: null,
    producedLeaseId: null,
    producedLeaseStatus: null,
    extendedBySeconds: null,
    extendedUntil: null,
    ...overrides,
  } as unknown as MyAccessRequestRow;
}

describe("HistoryTabComponent", () => {
  let fixture: ComponentFixture<HistoryTabComponent>;
  let component: HistoryTabComponent;
  let myRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let managedRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let managedIds$: BehaviorSubject<Set<string>>;
  let managedLoading$: BehaviorSubject<boolean>;
  let myLoading$: BehaviorSubject<boolean>;
  let myLoadError$: BehaviorSubject<unknown | null>;
  let lastSync$: BehaviorSubject<Date | null>;
  let inbox: {
    historyRows$: BehaviorSubject<MyAccessRequestRow[]>;
    managedIds$: BehaviorSubject<Set<string>>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    revokeLease: jest.Mock;
    cancelApproval: jest.Mock;
  };
  let canApprove$: BehaviorSubject<boolean>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

  function create(): void {
    fixture = TestBed.createComponent(HistoryTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  /** The ids of the rows the table actually renders, in the order the table renders them. */
  function renderedRowIds(): string[] {
    return [...fixture.nativeElement.querySelectorAll("tr[data-testid]")].map((row: HTMLElement) =>
      (row.getAttribute("data-testid") ?? "").replace("my-access-history-", ""),
    );
  }

  /** The text of every column header the table renders. */
  function renderedHeaders(): (string | undefined)[] {
    return [...fixture.nativeElement.querySelectorAll("th")].map((th: HTMLElement) =>
      th.textContent?.trim(),
    );
  }

  /** Switch to the approver-side scope and re-render. */
  function showManaged(): void {
    component["selectScope"]("managed");
    fixture.detectChanges();
  }

  /** Run past the skeleton's show delay and re-render. */
  function passSkeletonDelay(): void {
    jest.advanceTimersByTime(1000);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    myRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    managedRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    managedIds$ = new BehaviorSubject<Set<string>>(new Set());
    managedLoading$ = new BehaviorSubject(false);
    myLoading$ = new BehaviorSubject(false);
    myLoadError$ = new BehaviorSubject<unknown | null>(null);
    lastSync$ = new BehaviorSubject<Date | null>(new Date("2026-08-20T09:00:00.000Z"));
    inbox = {
      historyRows$: managedRows$,
      managedIds$,
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      loading$: managedLoading$,
      loadError$: new BehaviorSubject<unknown | null>(null),
      revokeLease: jest.fn().mockResolvedValue(undefined),
      cancelApproval: jest.fn().mockResolvedValue(undefined),
    };
    canApprove$ = new BehaviorSubject(false);
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [HistoryTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: MyAccessService,
          useValue: {
            historyRows$: myRows$,
            cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
            loading$: myLoading$,
            loadError$: myLoadError$,
          },
        },
        { provide: ApproverInboxService, useValue: inbox },
        { provide: ApprovalPrivilegeService, useValue: { canApprove$ } },
        { provide: SyncService, useValue: { activeUserLastSync$: () => lastSync$ } },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    })
      .overrideComponent(HistoryTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  describe("scope filter", () => {
    it("lands on All", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1" })]);

      create();

      expect(component["scope"]()).toBe("all");
      expect(query('[data-testid="history-scope-filter"]')).not.toBeNull();
    });

    it("is hidden from a viewer who can neither approve nor has managed rows", () => {
      myRows$.next([historyRow()]);

      create();

      expect(query('[data-testid="history-scope-filter"]')).toBeNull();
    });

    it("appears once the caller has managed history", () => {
      managedRows$.next([historyRow({ id: "managed-1" })]);

      create();

      expect(query('[data-testid="history-scope-filter"]')).not.toBeNull();
    });

    it("offers the filter to an approver with no managed history yet", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      expect(query('[data-testid="history-scope-filter"]')).not.toBeNull();
    });

    it("shows both sources merged under All, newest first", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1", resolvedAt: "2026-08-17T10:00:00.000Z" })]);
      managedRows$.next([
        historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" }),
        historyRow({ id: "managed-2", resolvedAt: "2026-08-17T09:00:00.000Z" }),
      ]);

      create();

      expect(component["historyRows"]().map((r) => r.id)).toEqual([
        "managed-1",
        "mine-1",
        "managed-2",
      ]);
    });

    // A request the caller raised against a collection they also manage comes back from both reads.
    it("lists a request that is both raised and managed by the caller only once under All", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "both-1" })]);
      managedRows$.next([historyRow({ id: "both-1" })]);

      create();

      expect(component["historyRows"]().map((r) => r.id)).toEqual(["both-1"]);
    });

    // Only the caller's own read folds an approved extension onto the grant it extended, so the
    // managed copy of the same request has no "Extended" badge to show.
    it("keeps the richer copy of a request both reads return", () => {
      canApprove$.next(true);
      myRows$.next([
        historyRow({
          id: "both-1",
          extendedBySeconds: 3600,
          extendedUntil: "2026-08-17T14:00:00.000Z",
        }),
      ]);
      managedRows$.next([historyRow({ id: "both-1" })]);

      create();

      expect(component["historyRows"]().map((r) => r.extendedUntil)).toEqual([
        "2026-08-17T14:00:00.000Z",
      ]);
      expect(query('[data-testid="my-access-history-extended-both-1"]')).not.toBeNull();
    });

    // Asserted on the rendered rows: the table re-orders whatever it is handed, so the merge's own
    // sort proves nothing about what the reader sees.
    it("sorts a row with no decision by when it was raised", () => {
      canApprove$.next(true);
      myRows$.next([
        historyRow({ id: "mine-1", resolvedAt: null, submittedAt: "2026-08-17T13:00:00.000Z" }),
      ]);
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);

      create();

      expect(renderedRowIds()).toEqual(["mine-1", "managed-1"]);
    });

    it("renders the merged list newest first", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1", resolvedAt: "2026-08-17T10:00:00.000Z" })]);
      managedRows$.next([
        historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" }),
        historyRow({ id: "managed-2", resolvedAt: "2026-08-17T09:00:00.000Z" }),
      ]);

      create();

      expect(renderedRowIds()).toEqual(["managed-1", "mine-1", "managed-2"]);
    });

    it("narrows to the caller's own rows, then restores the union", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);
      create();

      component["selectScope"]("mine");
      fixture.detectChanges();
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["mine-1"]);

      component["selectScope"]("all");
      fixture.detectChanges();
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1", "mine-1"]);
    });

    it("narrows to the managed rows, then restores the union", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);
      create();

      showManaged();
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1"]);

      component["selectScope"]("all");
      fixture.detectChanges();
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1", "mine-1"]);
    });

    it("keeps the viewer on the filter they picked when managed history arrives", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();

      component["selectScope"]("mine");
      managedRows$.next([historyRow({ id: "managed-1" })]);
      fixture.detectChanges();

      expect(component["scope"]()).toBe("mine");
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["mine-1"]);
    });

    it("does not move the reader off All when managed history arrives in the background", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();

      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);
      fixture.detectChanges();

      expect(component["scope"]()).toBe("all");
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1", "mine-1"]);
    });

    // A non-approver whose managed rows go away loses the filter, so their pinned filter stops
    // applying.
    it("falls back to All if the filter goes away while a filter is applied", () => {
      managedRows$.next([historyRow({ id: "managed-1" })]);
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();
      showManaged();

      managedRows$.next([]);
      fixture.detectChanges();

      expect(component["scope"]()).toBe("all");
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["mine-1"]);
    });

    // The fallback has to forget the pick, not just stop applying it: a background load that brings
    // a managed row back would otherwise narrow the table again with no user action.
    it("does not restore the filter it fell back from when the filter returns", () => {
      managedRows$.next([historyRow({ id: "managed-1" })]);
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();
      showManaged();

      managedRows$.next([]);
      fixture.detectChanges();
      expect(component["scope"]()).toBe("all");

      managedRows$.next([historyRow({ id: "managed-2", resolvedAt: "2026-08-17T12:00:00.000Z" })]);
      fixture.detectChanges();

      expect(component["scope"]()).toBe("all");
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-2", "mine-1"]);
    });
  });

  describe("loading", () => {
    it("shows the skeleton once the load has run for a second, then the managed history", () => {
      canApprove$.next(true);
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      expect(query('[data-testid="history-loading"]')).toBeNull();

      passSkeletonDelay();

      const skeleton = query('[data-testid="history-loading"]');
      expect(skeleton).not.toBeNull();
      expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
      expect(skeleton?.querySelectorAll("bit-skeleton").length).toBeGreaterThan(0);

      managedRows$.next([historyRow({ id: "managed-1" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-managed-1"]')).not.toBeNull();
    });

    it("never shows the skeleton when the history arrives inside a second", () => {
      canApprove$.next(true);
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      jest.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(query("bit-skeleton")).toBeNull();

      managedLoading$.next(false);
      passSkeletonDelay();

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
      expect(query('[data-testid="history-loading-status"]')?.textContent?.trim()).toBe("");
    });

    // The skeleton operator holds its own minimum display time, but what the reader sees is gated
    // on the content: the rows replace the skeleton the moment they land, rather than sitting
    // behind a skeleton drawn over a history that is already in hand.
    it("swaps the skeleton for the history the moment it lands, mid minimum-display-time", () => {
      canApprove$.next(true);
      managedLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(query('[data-testid="history-loading"]')).not.toBeNull();

      jest.advanceTimersByTime(200);
      managedRows$.next([historyRow({ id: "managed-1" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-managed-1"]')).not.toBeNull();
      expect(query('[data-testid="history-loading-status"]')?.textContent).toContain(
        "pamHistoryLoaded",
      );

      jest.advanceTimersByTime(800);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-managed-1"]')).not.toBeNull();
    });

    // A latched announcement leaves the region reporting a load that finished long ago to assistive
    // tech that re-reads region contents later in the session.
    it("clears the loaded announcement once it has been made", () => {
      canApprove$.next(true);
      managedLoading$.next(true);

      create();
      passSkeletonDelay();

      const status = query('[data-testid="history-loading-status"]');
      expect(status?.textContent).toContain("loading");

      managedRows$.next([historyRow({ id: "managed-1" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(status?.textContent).toContain("pamHistoryLoaded");

      jest.advanceTimersByTime(2000);
      fixture.detectChanges();

      expect(status?.textContent?.trim()).toBe("");
      expect(query('[data-testid="my-access-history-managed-1"]')).not.toBeNull();
    });

    // The latch never resolves for a non-approver on a session that has not synced, so nothing but
    // teardown ends the subscription it keeps on the privilege stream — and that stream keeps
    // organization and collection state decrypting behind it.
    it("drops its load-latch subscription when the tab is destroyed", () => {
      lastSync$.next(null);
      managedLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(component["historyLoaded"]()).toBe(false);
      expect(canApprove$.observed).toBe(true);

      fixture.destroy();

      expect(canApprove$.observed).toBe(false);
    });

    // A live region has to be in the DOM before its text changes for assistive tech to announce
    // them, and emptying it announces nothing on its own.
    it("keeps one live region mounted and announces both halves of the load", () => {
      canApprove$.next(true);
      managedLoading$.next(true);

      create();

      const status = query('[data-testid="history-loading-status"]');
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.getAttribute("aria-live")).toBe("polite");
      expect(status?.textContent?.trim()).toBe("");

      passSkeletonDelay();

      expect(query('[data-testid="history-loading-status"]')).toBe(status);
      expect(status?.textContent).toContain("loading");

      managedRows$.next([historyRow({ id: "managed-1" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading-status"]')).toBe(status);
      expect(status?.textContent).toContain("pamHistoryLoaded");
    });

    // The latch resolves on the loading flags alone, so a failed read ends the skeleton exactly like
    // a successful one and falls through to the same empty table — with the shell toasting the error
    // beside it. A sighted reader can weigh those two against each other; "Request history loaded"
    // read into the live region is the one claim that cannot be corrected.
    it("does not announce a failed managed-history load as loaded", () => {
      canApprove$.next(true);
      managedLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(query('[data-testid="history-loading-status"]')?.textContent).toContain("loading");

      inbox.loadError$.next(new Error("boom"));
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="history-loading-status"]')?.textContent?.trim()).toBe("");
    });

    // Either read failing leaves the merged list short by everything that side holds, so the
    // requester's own history guards the announcement on the same terms as the managed one.
    it("does not announce a failed own-history load as loaded", () => {
      myLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(query('[data-testid="history-loading-status"]')?.textContent).toContain("loading");

      myLoadError$.next(new Error("boom"));
      myLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="history-loading-status"]')?.textContent?.trim()).toBe("");
    });

    // The shell never loads the inbox for a member who cannot approve, so its loading flag stays
    // raised for the life of the page.
    it("does not wait on the inbox for a member who cannot approve", () => {
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
    });

    // On a cold load — a bookmark, or a hard refresh straight onto /pam/history — `canApprove$`
    // answers false for a genuine approver: it is derived from organization and collection state the
    // first sync has not delivered yet. The sync writes that state before stamping its date, so a
    // non-null last-sync date is what makes a `false` here trustworthy.
    it("waits for the first sync before reading a false approval privilege as settled", () => {
      lastSync$.next(null);
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();
      passSkeletonDelay();

      expect(query('[data-testid="history-loading"]')).not.toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).toBeNull();

      canApprove$.next(true);
      lastSync$.next(new Date("2026-08-20T09:05:00.000Z"));
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1", "mine-1"]);
    });

    it("waits on the caller's own history too, so its empty state cannot flash", () => {
      myLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(query('[data-testid="history-loading"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain("pamMyRequestsHistoryEmpty");

      myRows$.next([historyRow({ id: "mine-1" })]);
      myLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
    });

    it("does not replace rows already on screen with a skeleton when a reload starts", () => {
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();

      myLoading$.next(true);
      passSkeletonDelay();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
    });
  });

  describe("actions", () => {
    const activeGrant = historyRow({
      id: "managed-1",
      status: "approved",
      statusBadge: { labelKey: "pamStatusActivated", variant: "success" },
      producedLeaseId: "lease-1",
      producedLeaseStatus: "active",
    });
    const unstartedApproval = historyRow({
      id: "managed-2",
      status: "approved",
      badgeState: null,
      statusBadge: { labelKey: "pamStatusApproved", variant: "success" },
      producedLeaseId: null,
    });

    beforeEach(() => {
      managedIds$.next(new Set(["managed-1", "managed-2"]));
    });

    it("offers no actions on a row the caller only raised", () => {
      managedIds$.next(new Set());
      myRows$.next([activeGrant, unstartedApproval]);
      create();

      expect(component["canRevoke"](activeGrant)).toBe(false);
      expect(component["canCancelApproval"](unstartedApproval)).toBe(false);
      expect(query('[data-testid="history-revoke-managed-1"]')).toBeNull();
      expect(query('[data-testid="history-cancel-approval-managed-2"]')).toBeNull();
    });

    // The merged list carries rows from both sources, so the Actions column has to answer per row.
    it("offers actions under All only on the rows the caller manages", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([activeGrant]);
      create();

      expect(component["scope"]()).toBe("all");
      expect([...component["historyRows"]().map((r) => r.id)].sort()).toEqual([
        "managed-1",
        "mine-1",
      ]);
      expect(query('[data-testid="history-revoke-managed-1"]')).not.toBeNull();
      expect(query('[data-testid="history-revoke-mine-1"]')).toBeNull();
      expect(component["canRevoke"](historyRow({ id: "mine-1" }))).toBe(false);
    });

    it("hides the Actions column when nothing in the current list can be acted on", () => {
      canApprove$.next(true);
      managedIds$.next(new Set());
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();

      expect(renderedHeaders()).not.toContain("pamColumnActions");
    });

    // The column has to answer "can anything here be acted on", not "does the caller manage
    // anything here" — a decided-and-done managed history is all a mature approver ever has.
    it("hides the Actions column when every managed row is already terminal", () => {
      canApprove$.next(true);
      managedRows$.next([
        historyRow({ id: "managed-1", status: "denied" }),
        historyRow({
          id: "managed-2",
          status: "approved",
          statusBadge: { labelKey: "pamStatusRevoked", variant: "subtle" },
          producedLeaseId: "lease-1",
          producedLeaseStatus: "revoked",
        }),
      ]);
      create();
      showManaged();

      expect(renderedRowIds().sort()).toEqual(["managed-1", "managed-2"]);
      expect(renderedHeaders()).not.toContain("pamColumnActions");
    });

    // A request the caller raised against a collection they also manage is in `managedIds`, but
    // "Raised by me" only ever lists it once it is past anything Revoke or Withdraw could reach.
    it("hides the Actions column under Mine for a terminal row the caller both raised and manages", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "managed-1", status: "denied" })]);
      create();
      component["selectScope"]("mine");
      fixture.detectChanges();

      expect(renderedRowIds()).toEqual(["managed-1"]);
      expect(renderedHeaders()).not.toContain("pamColumnActions");
    });

    it("shows the Actions column once a listed row can be acted on", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([activeGrant]);
      create();

      expect(renderedHeaders()).toContain("pamColumnActions");
    });

    it("shows the Actions column for a managed approval the requester has not started", () => {
      canApprove$.next(true);
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      expect(renderedHeaders()).toContain("pamColumnActions");
    });

    it("keeps a managed row's actions when the caller filters down to All's subsets", () => {
      canApprove$.next(true);
      managedRows$.next([activeGrant]);
      create();

      expect(component["canRevoke"](activeGrant)).toBe(true);
      showManaged();
      expect(component["canRevoke"](activeGrant)).toBe(true);
    });

    it("offers Revoke for a live lease the caller granted", () => {
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      expect(component["canRevoke"](activeGrant)).toBe(true);
      expect(query('[data-testid="history-revoke-managed-1"]')).not.toBeNull();
    });

    it("offers Revoke for a live lease whose request status did not survive the round trip", () => {
      const mislabelled = historyRow({
        id: "managed-1",
        status: "denied",
        statusBadge: { labelKey: "pamStatusDenied", variant: "danger" },
        producedLeaseId: "lease-1",
        producedLeaseStatus: "active",
      });
      managedRows$.next([mislabelled]);
      create();
      showManaged();

      expect(component["canRevoke"](mislabelled)).toBe(true);
      expect(query('[data-testid="history-revoke-managed-1"]')).not.toBeNull();
    });

    it("offers no Revoke once the lease has already ended", () => {
      const revoked = historyRow({
        id: "managed-1",
        status: "approved",
        statusBadge: { labelKey: "pamStatusRevoked", variant: "subtle" },
        producedLeaseId: "lease-1",
        producedLeaseStatus: "revoked",
      });
      managedRows$.next([revoked]);
      create();
      showManaged();

      expect(component["canRevoke"](revoked)).toBe(false);
    });

    it("offers Withdraw approval for an approval the requester has not started", () => {
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      const withdraw = query('[data-testid="history-cancel-approval-managed-2"]');

      expect(component["canCancelApproval"](unstartedApproval)).toBe(true);
      expect(withdraw).not.toBeNull();
      expect(withdraw?.textContent).toContain("pamInboxWithdrawApproval");
    });

    it("offers no action for a row the caller does not manage", () => {
      managedIds$.next(new Set());
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      expect(component["canRevoke"](activeGrant)).toBe(false);
    });

    it("confirms before revoking, since this cuts off access already in use", async () => {
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      await component["revoke"](activeGrant);

      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(inbox.revokeLease).toHaveBeenCalledWith("managed-1", "lease-1");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxRevokedToast",
      });
    });

    it("does not revoke when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      await component["revoke"](activeGrant);

      expect(inbox.revokeLease).not.toHaveBeenCalled();
    });

    it("toasts an error when the revoke fails", async () => {
      inbox.revokeLease.mockRejectedValue(new Error("boom"));
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      await component["revoke"](activeGrant);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxRevokeFailed",
      });
    });

    it("confirms before withdrawing an approval", async () => {
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      await component["cancelApproval"](unstartedApproval);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "pamInboxWithdrawApprovalConfirm", placeholders: ["Prod database"] },
          type: "warning",
        }),
      );
      expect(inbox.cancelApproval).toHaveBeenCalledWith("managed-2");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxApprovalWithdrawnToast",
      });
    });

    it("does not withdraw the approval when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      await component["cancelApproval"](unstartedApproval);

      expect(inbox.cancelApproval).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("names the item by id in the confirm when the cipher is not in the approver's vault", async () => {
      const unnamed = { ...unstartedApproval, cipherName: null as string | null };
      managedRows$.next([unnamed]);
      create();
      showManaged();

      await component["cancelApproval"](unnamed);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "pamInboxWithdrawApprovalConfirm", placeholders: ["cipher-1"] },
        }),
      );
    });

    it("toasts an error when withdrawing an approval fails", async () => {
      inbox.cancelApproval.mockRejectedValue(new Error("boom"));
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      await component["cancelApproval"](unstartedApproval);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxWithdrawApprovalFailed",
      });
    });
  });

  // All spans both sources, so it cannot borrow either side's wording: an approver with no history
  // at all lands here and would be told they have raised nothing.
  it("says which slice is empty", () => {
    canApprove$.next(true);
    create();

    expect(fixture.nativeElement.textContent).toContain("pamHistoryEmpty");

    component["selectScope"]("mine");
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("pamMyRequestsHistoryEmpty");

    showManaged();

    expect(fixture.nativeElement.textContent).toContain("pamInboxHistoryEmpty");
  });
});
