import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { WithdrawApprovalDialogComponent } from "../approvals/withdraw-approval-dialog/withdraw-approval-dialog.component";

import { HistoryTabComponent } from "./history-tab.component";
import { historyDisplayStatus, MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

// Loosely typed, not `Partial<MyAccessRequestRow>`, since `id` is an opaque branded type.
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
    managedRequestParties: jest.Mock;
  };
  let canApprove$: BehaviorSubject<boolean>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

  function withdrawDialogCloses(result: unknown): void {
    dialogService.open.mockReturnValue({ closed: of(result) } as never);
  }

  function create(): void {
    fixture = TestBed.createComponent(HistoryTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function text(element: Element): string {
    return (element.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function table(): HTMLElement {
    return query("bit-table-v2")!;
  }

  function headings(): string[] {
    return [...table().querySelectorAll('[role="columnheader"]')].map(text);
  }

  /** The ids of the rendered rows, in rendered order, read off each row's Item cell. */
  function rowIds(): string[] {
    return [...table().querySelectorAll("bit-row")].map((row) =>
      row
        .querySelector("[data-testid]")!
        .getAttribute("data-testid")!
        .replace("my-access-history-", ""),
    );
  }

  /**
   * Drives the scope chip through its own `setValue`, as an option click would. `"all"` clears the
   * chip, since All is its reset row rather than an option.
   */
  function selectScope(scope: "mine" | "managed" | "all"): void {
    component["scopeChip"]()?.setValue(scope === "all" ? null : scope);
    fixture.detectChanges();
  }

  function showManaged(): void {
    selectScope("managed");
  }

  /**
   * Calls the search's own change handler, since `ngModel` registers over a microtask these
   * fake-timered tests never flush, so a raw `input` event reaches nothing.
   */
  function searchFor(term: string): void {
    const search = fixture.debugElement.query(By.css("bit-search")).componentInstance as {
      onChange: (term: string) => void;
    };
    search.onChange(term);
    fixture.detectChanges();
  }

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
      managedRequestParties: jest.fn().mockReturnValue({
        requesterName: "Grace Hopper",
        organizationName: "Meridian Group",
      }),
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

    it("derives Mine and Managed straight from the chip's own value", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1" })]);
      create();

      selectScope("mine");
      expect(component["scope"]()).toBe("mine");

      selectScope("managed");
      expect(component["scope"]()).toBe("managed");
    });

    it("falls back to All when the chip holds a value outside the known scopes", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1" })]);
      create();

      component["scopeChip"]()?.setValue("something-else");
      fixture.detectChanges();

      expect(component["scope"]()).toBe("all");
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

    it("is withheld from an approver with no history at all", () => {
      canApprove$.next(true);

      create();

      expect(query('[data-testid="history-scope-filter"]')).toBeNull();
      expect(component["scope"]()).toBe("all");
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

    // Only the caller's own read folds an approved extension onto its grant.
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

    // Asserted on rendered rows; the table re-orders whatever it's handed.
    it("sorts a row with no decision by when it was raised", () => {
      canApprove$.next(true);
      myRows$.next([
        historyRow({ id: "mine-1", resolvedAt: null, submittedAt: "2026-08-17T13:00:00.000Z" }),
      ]);
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);

      create();

      expect(rowIds()).toEqual(["mine-1", "managed-1"]);
    });

    it("renders the merged list newest first", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1", resolvedAt: "2026-08-17T10:00:00.000Z" })]);
      managedRows$.next([
        historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" }),
        historyRow({ id: "managed-2", resolvedAt: "2026-08-17T09:00:00.000Z" }),
      ]);

      create();

      expect(rowIds()).toEqual(["managed-1", "mine-1", "managed-2"]);
    });

    it("narrows to the caller's own rows, then restores the union", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);
      create();

      selectScope("mine");
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["mine-1"]);

      selectScope("all");
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1", "mine-1"]);
    });

    it("narrows to the managed rows, then restores the union", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: "2026-08-17T12:00:00.000Z" })]);
      create();

      showManaged();
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1"]);

      selectScope("all");
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1", "mine-1"]);
    });

    it("keeps the viewer on the filter they picked when managed history arrives", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();

      selectScope("mine");
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

    // A non-approver whose managed rows go away loses the chip, so their pinned scope stops
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

    // A latched announcement keeps reporting a long-finished load to assistive tech that re-reads
    // the region later.
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

    // The latch never resolves for a non-approver on an unsynced session.
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

    // A live region must exist before its text changes, or assistive tech announces nothing.
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

    // The latch resolves on loading flags alone; a failed read ends the skeleton same as success.
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

    // Either read failing leaves the merged list short of its full history.
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

    // The shell never loads the inbox for a member who can't approve.
    it("does not wait on the inbox for a member who cannot approve", () => {
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
    });

    // `canApprove$` answers false for a genuine approver before the first sync lands.
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
      expect(query('[data-testid="my-access-history-empty"]')).toBeNull();

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

      expect(headings()).not.toContain("pamColumnActions");
    });

    // The column answers whether anything here is actionable, not whether the caller manages
    // anything here.
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

      expect(rowIds().sort()).toEqual(["managed-1", "managed-2"]);
      expect(headings()).not.toContain("pamColumnActions");
    });

    it("hides the Actions column under Mine for a terminal row the caller both raised and manages", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "managed-1", status: "denied" })]);
      create();
      selectScope("mine");

      expect(rowIds()).toEqual(["managed-1"]);
      expect(headings()).not.toContain("pamColumnActions");
    });

    it("shows the Actions column once a listed row can be acted on", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([activeGrant]);
      create();

      expect(headings()).toContain("pamColumnActions");
    });

    it("shows the Actions column for a managed approval the requester has not started", () => {
      canApprove$.next(true);
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      expect(headings()).toContain("pamColumnActions");
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

    it("asks for a reason before withdrawing an approval, then sends it", async () => {
      withdrawDialogCloses({ confirmed: true, reason: "Approved by mistake" });
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      await component["cancelApproval"](unstartedApproval);

      expect(dialogService.open).toHaveBeenCalledWith(WithdrawApprovalDialogComponent, {
        data: expect.objectContaining({
          itemName: "Prod database",
          organizationName: "Meridian Group",
          requesterName: "Grace Hopper",
        }),
      });
      expect(inbox.cancelApproval).toHaveBeenCalledWith("managed-2", "Approved by mistake");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxApprovalWithdrawnToast",
      });
    });

    it("does not withdraw the approval when the dialog is dismissed", async () => {
      withdrawDialogCloses(undefined);
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      await component["cancelApproval"](unstartedApproval);

      expect(inbox.cancelApproval).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("names the item by id in the dialog when the cipher is not in the approver's vault", async () => {
      withdrawDialogCloses(undefined);
      const unnamed = historyRow({ ...unstartedApproval, cipherName: null });
      managedRows$.next([unnamed]);
      create();
      showManaged();

      await component["cancelApproval"](unnamed);

      expect(dialogService.open).toHaveBeenCalledWith(WithdrawApprovalDialogComponent, {
        data: expect.objectContaining({ itemName: "cipher-1" }),
      });
    });

    it("ignores a second click while the withdrawal is still in flight", async () => {
      withdrawDialogCloses({ confirmed: true, reason: "Approved by mistake" });
      inbox.cancelApproval.mockReturnValue(new Promise(() => {}));
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      void component["cancelApproval"](unstartedApproval);
      await jest.advanceTimersByTimeAsync(0);
      await component["cancelApproval"](unstartedApproval);

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(inbox.cancelApproval).toHaveBeenCalledTimes(1);
    });

    it("toasts an error when withdrawing an approval fails", async () => {
      withdrawDialogCloses({ confirmed: true, reason: "Approved by mistake" });
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

  describe("table", () => {
    const liveGrant = historyRow({
      id: "managed-live",
      status: "approved",
      statusBadge: { labelKey: "pamStatusActivated", variant: "success" },
      producedLeaseId: "lease-live",
      producedLeaseStatus: "active",
      resolvedAt: "2026-08-17T12:00:00.000Z",
    });
    const unstartedApproval = historyRow({
      id: "managed-unstarted",
      status: "approved",
      statusBadge: { labelKey: "pamStatusApproved", variant: "success" },
      producedLeaseId: null,
      resolvedAt: "2026-08-17T10:00:00.000Z",
    });
    const deniedManaged = historyRow({
      id: "managed-denied",
      resolvedAt: "2026-08-17T08:00:00.000Z",
    });

    function endedLease(id: string, producedLeaseStatus: "canceled" | "revoked") {
      const request = {
        status: "approved",
        producedLeaseId: `lease-${id}`,
        producedLeaseStatus,
      } as unknown as Parameters<typeof historyDisplayStatus>[0];
      return historyRow({ id, ...request, ...historyDisplayStatus(request) });
    }

    function sortableHeadings(): string[] {
      return [...table().querySelectorAll('[role="columnheader"]')]
        .filter((header) => header.querySelector("button") != null)
        .map(text);
    }

    function actions(): { testId: string | null; label: string; id: string }[] {
      return [...table().querySelectorAll<HTMLButtonElement>("button[data-testid]")].map(
        (button) => ({
          testId: button.getAttribute("data-testid"),
          label: text(button),
          id: button.id,
        }),
      );
    }

    function clickSortHeader(heading: string): void {
      const header = [...table().querySelectorAll('[role="columnheader"]')].find(
        (candidate) => text(candidate) === heading,
      )!;
      header.querySelector("button")!.click();
      fixture.detectChanges();
    }

    function populateApprover(): void {
      canApprove$.next(true);
      managedIds$.next(new Set(["managed-live", "managed-unstarted", "managed-denied"]));
      myRows$.next([
        historyRow({ id: "mine-1", resolvedAt: "2026-08-17T11:00:00.000Z" }),
        historyRow({
          id: "mine-undecided",
          resolvedAt: null,
          submittedAt: "2026-08-17T13:00:00.000Z",
        }),
      ]);
      managedRows$.next([deniedManaged, liveGrant, unstartedApproval]);
    }

    it("renders the history in bit-table-v2", () => {
      populateApprover();

      create();

      expect(query("bit-table-v2")).not.toBeNull();
    });

    it("sizes the skeleton's columns to match the loaded table's", () => {
      canApprove$.next(true);
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();
      passSkeletonDelay();

      const skeleton = query('[data-testid="history-loading"] bit-table-v2')!;
      const skeletonRows = [...skeleton.querySelectorAll<HTMLElement>("bit-header-row, bit-row")];
      expect(skeleton.querySelectorAll("bit-row")).toHaveLength(5);
      expect(headings()).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamColumnResolver",
        "pamColumnComment",
        "pamColumnResolved",
      ]);
      const skeletonTracks = skeletonRows.map((row) => row.style.gridTemplateColumns);

      managedRows$.next([historyRow({ id: "managed-1" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      const loadedTracks = query("bit-table-v2 bit-header-row")!.style.gridTemplateColumns;
      expect(loadedTracks).not.toBe("");
      expect(skeletonTracks).toEqual(skeletonRows.map(() => loadedTracks));
    });

    it("renders the column headings in order", () => {
      populateApprover();

      create();

      expect(headings()).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamColumnResolver",
        "pamColumnComment",
        "pamColumnResolved",
        "pamColumnActions",
      ]);
    });

    it("renders every row, newest resolved-or-submitted first", () => {
      populateApprover();

      create();

      expect(rowIds()).toEqual([
        "mine-undecided",
        "managed-live",
        "mine-1",
        "managed-unstarted",
        "managed-denied",
      ]);
    });

    it("sorts on Item, Status and Resolved only", () => {
      populateApprover();

      create();

      expect(sortableHeadings()).toEqual(["pamColumnItem", "pamColumnStatus", "pamColumnResolved"]);
    });

    it("reverses the Resolved sort on a header click, keeping undecided rows at their submitted place", () => {
      populateApprover();
      create();

      clickSortHeader("pamColumnResolved");

      expect(rowIds()).toEqual([
        "managed-denied",
        "managed-unstarted",
        "mine-1",
        "managed-live",
        "mine-undecided",
      ]);
    });

    it("offers Revoke and Withdraw approval only on the rows they apply to", () => {
      populateApprover();

      create();

      expect(actions().map(({ testId, label }) => ({ testId, label }))).toEqual([
        { testId: "history-revoke-managed-live", label: "pamInboxRevoke" },
        { testId: "history-cancel-approval-managed-unstarted", label: "pamInboxWithdrawApproval" },
      ]);
    });

    it("gives every row action a descriptive id", () => {
      populateApprover();

      create();

      expect(actions().map(({ id }) => id)).toEqual([
        "pam-history-tab_button_revoke-managed-live",
        "pam-history-tab_button_withdraw-approval-managed-unstarted",
      ]);
    });

    it("routes Revoke and Withdraw approval through the component's actions", async () => {
      withdrawDialogCloses({ confirmed: true, reason: "Approved by mistake" });
      populateApprover();
      create();

      query('[data-testid="history-revoke-managed-live"]')!.click();
      query('[data-testid="history-cancel-approval-managed-unstarted"]')!.click();
      await jest.advanceTimersByTimeAsync(0);

      expect(inbox.revokeLease).toHaveBeenCalledWith("managed-live", "lease-live");
      expect(inbox.cancelApproval).toHaveBeenCalledWith("managed-unstarted", "Approved by mistake");
    });

    it("labels a requester-canceled lease and an operator-revoked one differently", () => {
      myRows$.next([
        endedLease("ended-canceled", "canceled"),
        endedLease("ended-revoked", "revoked"),
      ]);

      create();

      expect(text(query('[data-testid="my-access-history-status-ended-canceled"]')!)).toBe(
        "pamStatusCanceled",
      );
      expect(text(query('[data-testid="my-access-history-status-ended-revoked"]')!)).toBe(
        "pamStatusRevoked",
      );
    });

    it("shows each row's item, collection, resolver, comment, extension and status", () => {
      canApprove$.next(true);
      myRows$.next([
        historyRow({
          id: "mine-1",
          approverComment: "Use the replica.",
          extendedBySeconds: 3600,
          extendedUntil: "2026-08-17T14:00:00.000Z",
        }),
        historyRow({ id: "mine-2", resolverName: null, resolverLabelKey: "pamResolverAccessRule" }),
      ]);

      create();

      const rendered = text(table());
      expect(rendered).toContain("Prod database");
      expect(rendered).toContain("pamInboxInCollection Production");
      expect(rendered).toContain("Ada");
      expect(rendered).toContain("pamResolverAccessRule");
      expect(rendered).toContain("Use the replica.");
      expect(query('[data-testid="my-access-history-extended-mine-1"]')).not.toBeNull();
      expect(query('[data-testid="my-access-history-status-mine-1"]')!.textContent).toContain(
        "pamStatusDenied",
      );
    });

    it("links each item to its request with a real anchor", () => {
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      expect(query('[data-testid="my-access-history-mine-1"] a')?.getAttribute("href")).toBe(
        "/pam/requests/mine-1",
      );
    });

    it("narrows the table through the scope chip", () => {
      populateApprover();
      create();

      selectScope("mine");
      expect(rowIds()).toEqual(["mine-undecided", "mine-1"]);

      showManaged();
      expect(rowIds()).toEqual(["managed-live", "managed-unstarted", "managed-denied"]);
    });

    it("puts the scope chip in the table's toolbar", () => {
      populateApprover();

      create();

      expect(query('bit-table-toolbar [data-testid="history-scope-filter"]')).not.toBeNull();
      expect(query('bit-table-v2 [data-testid="history-scope-filter"]')).not.toBeNull();
    });

    it("renders the chip's label and options in the toolbar", () => {
      populateApprover();

      create();

      const chip = text(query('[data-testid="history-scope-filter"]')!);
      expect(chip).toContain("pamHistoryScopeLabel");
      expect(chip).toContain("pamHistoryScopeMine");
      expect(chip).toContain("pamHistoryScopeManaged");
    });

    it("replaces the table and its toolbar with the empty state for an approver with no history", () => {
      canApprove$.next(true);

      create();

      const empty = text(query('[data-testid="my-access-history-empty"]')!);
      expect(empty).toContain("pamHistoryEmptyTitle");
      expect(empty).toContain("pamHistoryEmptyDescription");
      expect(query("bit-table-v2")).toBeNull();
      expect(query('[data-testid="history-scope-filter"]')).toBeNull();
    });

    it("replaces the table and its search with the empty state for a member with no history", () => {
      create();

      expect(query('[data-testid="my-access-history-empty"]')).not.toBeNull();
      expect(query("bit-table-v2")).toBeNull();
      expect(query("bit-search")).toBeNull();
    });

    it("holds the scope when the chosen scope matches nothing", () => {
      canApprove$.next(true);
      managedIds$.next(new Set(["managed-denied"]));
      managedRows$.next([deniedManaged]);
      create();

      selectScope("mine");

      expect(component["scope"]()).toBe("mine");
      expect(rowIds()).toEqual([]);
      expect(text(query('[data-testid="my-access-history-scope-empty"]')!)).toContain(
        "pamMyRequestsHistoryEmpty",
      );
      expect(query('bit-table-toolbar [data-testid="history-scope-filter"]')).not.toBeNull();
    });

    it("shows the hidden skeleton as a table while the history loads", () => {
      canApprove$.next(true);
      managedLoading$.next(true);
      create();
      passSkeletonDelay();

      const skeleton = query('[data-testid="history-loading"]')!;
      expect(skeleton.getAttribute("aria-hidden")).toBe("true");
      expect(skeleton.querySelector("bit-table-v2")).not.toBeNull();
      expect(skeleton.querySelectorAll("bit-row")).toHaveLength(5);
      expect([...skeleton.querySelectorAll('[role="columnheader"]')].map(text)).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamColumnResolver",
        "pamColumnComment",
        "pamColumnResolved",
      ]);

      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
    });

    // Reserves the space the scope chip will occupy, so the table does not jump when the rows land.
    it("reserves the scope-chip row while loading", () => {
      canApprove$.next(true);
      managedLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(
        query('[data-testid="history-loading"]')!.querySelector('bit-skeleton[edgeShape="circle"]'),
      ).not.toBeNull();
    });

    describe("toolbar search", () => {
      const namedRows = [
        historyRow({
          id: "mine-db",
          cipherName: "Prod database",
          collectionName: "Production",
          resolverName: "Ada",
          approverComment: "Use the replica.",
          resolvedAt: "2026-08-17T12:00:00.000Z",
        }),
        historyRow({
          id: "mine-cache",
          cipherName: "Staging cache",
          collectionName: "Staging",
          resolverName: "Grace",
          approverComment: null,
          resolvedAt: "2026-08-17T11:00:00.000Z",
        }),
      ];

      // With a filter row beneath, the toolbar's top row draws its own bottom border, so left
      // empty it shows a bare bordered band.
      it("fills the toolbar's top row with a search rather than leaving it empty", () => {
        populateApprover();

        create();

        const searchEl = query("bit-table-toolbar bit-search")!;
        expect(searchEl).not.toBeNull();
        expect(searchEl.closest("[bitOverflowList]")).toBeNull();
      });

      it("narrows the table to the rows whose item name matches", () => {
        myRows$.next(namedRows);
        create();

        searchFor("staging cache");

        expect(rowIds()).toEqual(["mine-cache"]);
      });

      it("matches the resolver and the approver's comment as well as the item", () => {
        myRows$.next(namedRows);
        create();

        searchFor("grace");
        expect(rowIds()).toEqual(["mine-cache"]);

        searchFor("replica");
        expect(rowIds()).toEqual(["mine-db"]);

        searchFor("production");
        expect(rowIds()).toEqual(["mine-db"]);
      });

      it("ignores case and surrounding whitespace", () => {
        myRows$.next(namedRows);
        create();

        searchFor("  PROD DATA  ");

        expect(rowIds()).toEqual(["mine-db"]);
      });

      it("restores the full list when the term is cleared", () => {
        myRows$.next(namedRows);
        create();

        searchFor("grace");
        expect(rowIds()).toEqual(["mine-cache"]);

        searchFor("");
        expect(rowIds()).toEqual(["mine-db", "mine-cache"]);
      });

      it("searches inside the chosen scope, not across it", () => {
        populateApprover();
        myRows$.next([namedRows[0]]);
        managedRows$.next([namedRows[1]]);
        create();

        selectScope("mine");
        searchFor("staging");

        expect(rowIds()).toEqual([]);
      });

      // The empty state says nothing was resolved, which is not what an unmatched search means.
      it("says nothing matched rather than that the history is empty", () => {
        myRows$.next(namedRows);
        create();

        searchFor("no-such-thing");

        expect(rowIds()).toEqual([]);
        expect(query('[data-testid="my-access-history-scope-empty"]')).toBeNull();
        expect(text(query('[data-testid="my-access-history-no-results"]')!)).toContain(
          "noMatchingItems",
        );
      });
    });

    describe("scope chip counts", () => {
      function optionCount(scope: "mine" | "managed" | null): number | undefined {
        return component["tableRef"]()!.optionCount("historyScope", scope);
      }

      it("counts each scope's own rows, whichever scope is listed", () => {
        populateApprover();
        create();

        expect([optionCount(null), optionCount("mine"), optionCount("managed")]).toEqual([5, 2, 3]);

        selectScope("managed");

        expect([optionCount(null), optionCount("mine"), optionCount("managed")]).toEqual([5, 2, 3]);
      });
    });
  });

  describe("empty state", () => {
    it("takes the chip away with the rows and shows the empty history copy", () => {
      canApprove$.next(true);

      create();

      expect(query('[data-testid="history-scope-filter"]')).toBeNull();
      const empty = query('[data-testid="my-access-history-empty"]')!;
      expect(empty.textContent).toContain("pamHistoryEmptyTitle");
      expect(empty.textContent).toContain("pamHistoryEmptyDescription");
    });

    it("keeps the chip and names the empty slice when another scope still holds rows", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();

      showManaged();

      expect(query('[data-testid="history-scope-filter"]')).not.toBeNull();
      expect(query('[data-testid="my-access-history-empty"]')).toBeNull();
      expect(query('[data-testid="my-access-history-scope-empty"]')!.textContent).toContain(
        "pamInboxHistoryEmpty",
      );
    });

    it("names an empty Mine against a history of managed rows", () => {
      managedRows$.next([historyRow({ id: "managed-1" })]);
      create();

      selectScope("mine");

      expect(query('[data-testid="history-scope-filter"]')).not.toBeNull();
      expect(query('[data-testid="my-access-history-scope-empty"]')!.textContent).toContain(
        "pamMyRequestsHistoryEmpty",
      );
    });
  });
});
