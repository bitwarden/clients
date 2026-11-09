import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of, BehaviorSubject } from "rxjs";

import { ACCESS_BADGE_LOOK, formatCalendarDate } from "@bitwarden/bit-pam";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BitTableV2Component,
  DialogService,
  FilterControl,
  ToastService,
} from "@bitwarden/components";

import { MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const LEASE_END = "2026-08-20T12:00:00.000Z";

/**
 * The ids of the per-second clocks a spied `setInterval` created, apart from Angular's own
 * zero-delay scheduler timers.
 */
function secondlyIntervalIds(spy: jest.SpyInstance): unknown[] {
  return spy.mock.results
    .filter((_, index) => spy.mock.calls[index][1] === 1000)
    .map((result) => result.value);
}

// Loosely typed, not `Partial<MyAccessLeaseRow>`, since row ids are opaque branded types.
function leaseRow(overrides: Record<string, unknown> = {}): MyAccessLeaseRow {
  return {
    id: "lease-1",
    requestId: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    cipherName: "Prod database",
    collectionName: "Production",
    notBefore: "2026-08-20T11:00:00.000Z",
    notAfter: LEASE_END,
    extendedBySeconds: null,
    extendedUntil: null,
    ...overrides,
  } as unknown as MyAccessLeaseRow;
}

function requestRow(overrides: Record<string, unknown> = {}): MyAccessRequestRow {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    cipherName: "Prod database",
    collectionName: "Production",
    status: "approved",
    badgeState: null,
    statusBadge: { labelKey: "pamStatusApproved", variant: "success" },
    submittedAt: "2026-08-17T11:00:00.000Z",
    resolvedAt: "2026-08-17T11:05:00.000Z",
    leaseNotBefore: "2026-08-17T11:00:00.000Z",
    leaseNotAfter: "2099-01-01T00:00:00.000Z",
    resolverLabelKey: null,
    resolverName: "Ada",
    approverComment: null,
    producedLeaseId: null,
    extendedBySeconds: null,
    extendedUntil: null,
    ...overrides,
  } as unknown as MyAccessRequestRow;
}

describe("MyRequestsTabComponent", () => {
  let fixture: ComponentFixture<MyRequestsTabComponent>;
  let component: MyRequestsTabComponent;
  let pendingRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let extensionRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let leases$: BehaviorSubject<MyAccessLeaseRow[]>;
  let loading$: BehaviorSubject<boolean>;
  let loadError$: BehaviorSubject<unknown | null>;
  let myAccess: {
    pendingRows$: BehaviorSubject<MyAccessRequestRow[]>;
    extensionRows$: BehaviorSubject<MyAccessRequestRow[]>;
    leases$: BehaviorSubject<MyAccessLeaseRow[]>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    activate: jest.Mock;
    cancel: jest.Mock;
    endLease: jest.Mock;
  };
  let toastService: MockProxy<ToastService>;
  let dialogService: MockProxy<DialogService>;

  /**
   * The chip as the table itself sees it. Reading the registered control keeps the spec on the
   * page's own seam rather than a view child the component never uses.
   */
  function chipControl(key: string): FilterControl {
    const table = fixture.debugElement.query(By.directive(BitTableV2Component))
      .componentInstance as BitTableV2Component;
    const control = table.filterControls().find((c) => c.key() === key);
    if (control == null) {
      throw new Error(`the ${key} chip did not register with the table`);
    }
    return control;
  }

  function create(): void {
    fixture = TestBed.createComponent(MyRequestsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
    pendingRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    extensionRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    leases$ = new BehaviorSubject<MyAccessLeaseRow[]>([]);
    // Settled by default: the tab renders neither empty state until the first read finishes, so
    // a spec that left this loading would see no table at all.
    loading$ = new BehaviorSubject<boolean>(false);
    loadError$ = new BehaviorSubject<unknown | null>(null);
    myAccess = {
      pendingRows$,
      extensionRows$,
      leases$,
      loading$,
      loadError$,
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      activate: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      endLease: jest.fn().mockResolvedValue(undefined),
    };
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();

    await TestBed.configureTestingModule({
      imports: [MyRequestsTabComponent, NoopAnimationsModule],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        provideRouter([]),
        { provide: MyAccessService, useValue: myAccess },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    })
      .overrideComponent(MyRequestsTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("active lease countdown", () => {
    it("rests on the accent 'time left' badge while the lease has plenty of time", () => {
      leases$.next([leaseRow()]);

      create();

      expect(query('[data-testid="access-state-badge-active"]')).not.toBeNull();
      expect(query('[data-testid="access-state-badge-ending-soon"]')).toBeNull();
    });

    it("shows the danger 'ending soon' badge inside the last five minutes", () => {
      jest.setSystemTime(new Date("2026-08-20T11:57:00.000Z"));
      leases$.next([leaseRow()]);

      create();

      expect(query('[data-testid="access-state-badge-ending-soon"]')).not.toBeNull();
      expect(query('[data-testid="access-state-badge-active"]')).toBeNull();
    });

    it("escalates without a reload as the clock crosses the threshold", () => {
      jest.setSystemTime(new Date("2026-08-20T11:52:00.000Z"));
      leases$.next([leaseRow()]);
      create();
      expect(query('[data-testid="access-state-badge-active"]')).not.toBeNull();

      jest.advanceTimersByTime(4 * 60_000);
      fixture.detectChanges();

      expect(query('[data-testid="access-state-badge-ending-soon"]')).not.toBeNull();
    });

    it("hands the badge the lease expiry as its active state", () => {
      const lease = leaseRow();
      leases$.next([lease]);

      create();

      expect(fixture.componentInstance["leaseBadgeState"](lease.id)).toEqual({
        kind: "active",
        expiresAt: new Date(LEASE_END),
      });
    });
  });

  describe("activating an approved request", () => {
    const row = requestRow({ id: "req-1" });

    it("maps the server's reason to a client-side i18n key without leaking the raw payload", async () => {
      const error = Object.assign(
        new Error(
          'error in response: status code 409 Conflict: {"object":"error",' +
            '"message":"This request has not been approved yet.","validationErrors":null,' +
            '"exceptionMessage":"This request has not been approved yet.",' +
            '"exceptionStackTrace":"   at Bit.Services.Pam.OrganizationFeatures.Commands' +
            ".ActivateAccessRequestCommand.ActivateAsync(Guid userId, Guid requestId) in " +
            '/src/bitwarden_license/src/Services/Pam/.../ActivateAccessRequestCommand.cs:line 65"}',
        ),
        { name: "AccessRequestError", variant: "Api" },
      );
      myAccess.activate.mockRejectedValue(error);
      create();

      await component["activate"](row);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseErrorNotApproved",
      });
      const shown = toastService.showToast.mock.calls[0][0].message as string;
      expect(shown).not.toContain("exceptionStackTrace");
      expect(shown).not.toContain("Bit.Services.Pam");
    });

    it("names the unopened window when the server rejects activation for it", async () => {
      const error = Object.assign(
        new Error(
          'error in response: status code 400 Bad Request: {"object":"error",' +
            '"message":"The approved access window has not started yet.","validationErrors":null,' +
            '"exceptionMessage":"The approved access window has not started yet.",' +
            '"exceptionStackTrace":"   at Bit.Services.Pam.OrganizationFeatures.Commands' +
            ".ActivateAccessRequestCommand.ActivateAsync(Guid userId, Guid requestId) in " +
            '/src/bitwarden_license/src/Services/Pam/.../ActivateAccessRequestCommand.cs:line 52"}',
        ),
        { name: "AccessRequestError", variant: "Api" },
      );
      myAccess.activate.mockRejectedValue(error);
      create();

      await component["activate"](row);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseErrorWindowNotStarted",
      });
    });

    it("falls back to the generic message for a non-leasing failure", async () => {
      myAccess.activate.mockRejectedValue(new Error("offline"));
      create();

      await component["activate"](row);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseError",
      });
    });

    it("falls back to the generic message for an AccessRequestError-shaped failure", async () => {
      const error = Object.assign(new Error("internal detail"), {
        name: "AccessRequestError",
        variant: "SingleActiveLease",
      });
      myAccess.activate.mockRejectedValue(error);
      create();

      await component["activate"](row);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseError",
      });
    });
  });

  describe("the countdown clock", () => {
    it("runs no clock at all when nothing on the tab has a window to lapse", () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");
      leases$.next([leaseRow()]);

      create();

      expect(secondlyIntervalIds(setIntervalSpy)).toHaveLength(1); // the badge's own, not a second
    });

    it("shares one clock with the badges it renders, and tears it down on destroy", () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
      pendingRows$.next([requestRow()]);
      leases$.next([leaseRow()]);

      create();

      const [intervalId] = secondlyIntervalIds(setIntervalSpy);
      expect(secondlyIntervalIds(setIntervalSpy)).toHaveLength(1);
      expect(clearIntervalSpy).not.toHaveBeenCalledWith(intervalId);

      fixture.destroy();

      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });

    it("holds no clock when there is neither a request nor a lease to watch", () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");

      create();

      expect(secondlyIntervalIds(setIntervalSpy)).toHaveLength(0);
    });
  });

  describe("the requests table", () => {
    function queryAll(root: ParentNode, selector: string): HTMLElement[] {
      return Array.from(root.querySelectorAll<HTMLElement>(selector));
    }

    function text(element: Element): string {
      return (element.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    const table = () => query("bit-table-v2")!;

    function headings(): string[] {
      return queryAll(table(), '[role="columnheader"], th').map(text);
    }

    function rows(): HTMLElement[] {
      return queryAll(table(), "bit-row, tr[bitRow]");
    }

    function rowIds(): (string | null)[] {
      return rows().map(
        (row) =>
          (row.matches("[data-testid]") ? row : row.querySelector("[data-testid]"))?.getAttribute(
            "data-testid",
          ) ?? null,
      );
    }

    function chips(): HTMLElement[] {
      return queryAll(fixture.nativeElement, "bit-filter-menu");
    }

    function chipFor(key: string): HTMLElement | undefined {
      return chips().find((chip) => chip.getAttribute("key") === key);
    }

    function optionLabels(chip: HTMLElement): string[] {
      return queryAll(chip, "bit-filter-option").map(text);
    }

    function oneOfEach(): void {
      leases$.next([leaseRow()]);
      pendingRows$.next([
        requestRow({ id: "req-grant", cipherName: "Grant", status: "approved" }),
        requestRow({ id: "req-pending", cipherName: "Waiting", status: "pending" }),
      ]);
    }

    it("replaces the three sections with a single table", () => {
      oneOfEach();
      create();

      expect(queryAll(fixture.nativeElement, "bit-table-v2")).toHaveLength(1);
      expect(queryAll(fixture.nativeElement, "bit-accordion")).toHaveLength(0);
    });

    it("renders the designed columns in order, Actions among them and visible", () => {
      oneOfEach();
      create();

      expect(headings()).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamColumnRequestedWindow",
        "pamColumnActions",
      ]);
      // Shown rather than screen-reader-only, as it is on Approvals.
      const actionsHeader = queryAll(table(), '[role="columnheader"], th').at(-1)!;
      expect(actionsHeader.querySelector(".tw-sr-only")).toBeNull();
      expect(text(actionsHeader)).toContain("pamColumnActions");
    });

    it("lists held access, grants and undecided requests together", () => {
      oneOfEach();
      create();

      expect(rowIds()).toEqual([
        "my-access-lease-lease-1",
        "my-access-request-req-grant",
        "my-access-request-req-pending",
      ]);
    });

    it("keeps a pending extension visible rather than dropping it with its section", () => {
      extensionRows$.next([requestRow({ id: "req-ext", status: "pending" })]);
      create();

      expect(rowIds()).toContain("my-access-extension-req-ext");
    });

    it("offers only Cancel on an undecided request, under the designed glyph", () => {
      pendingRows$.next([requestRow({ id: "req-pending", status: "pending" })]);
      create();

      const cancel = query('[data-testid="my-access-cancel-req-pending"]');
      expect(cancel).not.toBeNull();
      // Figma names this glyph "clear" and maps it to bwi-error, a circled cross, not a bare one.
      expect(cancel?.querySelector("i")?.className).toContain("bwi-error");
      expect(query('[data-testid="my-access-approved-start-req-pending"]')).toBeNull();
    });

    it("offers Start and Cancel on a grant that can still be used, under the designed glyphs", () => {
      pendingRows$.next([requestRow({ id: "req-grant", status: "approved" })]);
      create();

      const start = query('[data-testid="my-access-approved-start-req-grant"]');
      const cancel = query('[data-testid="my-access-cancel-req-grant"]');
      expect(start).not.toBeNull();
      expect(cancel).not.toBeNull();
      // Both circled, per the Action cell frame: check-circle to start, clear to cancel.
      expect(start?.querySelector("i")?.className).toContain("bwi-check-circle");
      expect(cancel?.querySelector("i")?.className).toContain("bwi-error");
    });

    it("withholds Start on a grant whose window has not opened yet", () => {
      pendingRows$.next([
        requestRow({
          id: "req-scheduled",
          status: "approved",
          leaseNotBefore: "2026-08-21T09:00:00.000Z",
          leaseNotAfter: "2026-08-21T13:00:00.000Z",
        }),
      ]);
      create();

      expect(query('[data-testid="my-access-approved-start-req-scheduled"]')).toBeNull();
    });

    it("keeps a scheduled grant cancellable before its window opens", () => {
      pendingRows$.next([
        requestRow({
          id: "req-scheduled",
          status: "approved",
          leaseNotBefore: "2026-08-21T09:00:00.000Z",
          leaseNotAfter: "2026-08-21T13:00:00.000Z",
        }),
      ]);
      create();

      expect(query('[data-testid="my-access-cancel-req-scheduled"]')).not.toBeNull();
    });

    it("badges a scheduled grant Ready to use, and counts it the same way", () => {
      pendingRows$.next([
        requestRow({
          id: "req-scheduled",
          status: "approved",
          leaseNotBefore: "2026-08-21T09:00:00.000Z",
          leaseNotAfter: "2026-08-21T13:00:00.000Z",
        }),
      ]);
      create();

      expect(query('[data-testid="access-state-badge-ready"]')).not.toBeNull();
      expect(query('[data-testid="my-access-approved-status-req-scheduled"]')).toBeNull();
      expect(component["statusCounts"]().get("ready")).toBe(1);
      expect(query('[data-testid="my-access-approved-start-req-scheduled"]')).toBeNull();
    });

    it("offers only End access on held access, under the designed glyph", () => {
      leases$.next([leaseRow()]);
      create();

      const end = query('[data-testid="my-access-end-lease-1"]');
      expect(end).not.toBeNull();
      // The same circled cross the cancel action wears, on the danger pill.
      expect(end?.querySelector("i")?.className).toContain("bwi-error");
      expect(query('[data-testid="my-access-cancel-lease-1"]')).toBeNull();
    });

    it("withholds both actions on a grant whose window has lapsed", () => {
      pendingRows$.next([
        requestRow({ id: "req-lapsed", status: "approved", leaseNotAfter: "2020-01-01T00:00:00Z" }),
      ]);
      create();

      expect(query('[data-testid="my-access-approved-start-req-lapsed"]')).toBeNull();
      expect(query('[data-testid="my-access-cancel-req-lapsed"]')).toBeNull();
    });

    it("links each item to its request", () => {
      leases$.next([leaseRow()]);
      create();

      expect(query("bit-table-v2 a")?.getAttribute("href")).toContain("/pam/requests/req-1");
    });

    describe("the row", () => {
      it("marks the item as organization-owned beside its name", () => {
        leases$.next([leaseRow()]);
        create();

        const icon = query('bit-table-v2 bit-icon[name="bwi-business"]');
        expect(icon).not.toBeNull();
      });

      it("names the shared folder on the line below, without a glyph", () => {
        leases$.next([leaseRow()]);
        create();

        const secondary = query('bit-table-v2 [slot="secondary"]');
        expect(secondary?.textContent).toContain("pamInboxInSharedFolder Production");
        expect(secondary?.querySelector("bit-icon")).toBeNull();
      });

      it("leads the window with its length and states the range below", () => {
        jest.setSystemTime(new Date("2026-08-20T09:00:00.000Z"));
        pendingRows$.next([
          requestRow({
            id: "req-window",
            status: "pending",
            leaseNotBefore: "2026-08-20T11:00:00.000Z",
            leaseNotAfter: "2026-08-20T13:00:00.000Z",
          }),
        ]);
        create();

        const cell = queryAll(table(), "bit-cell").find((c) =>
          c.textContent?.includes("pamWindowRange"),
        );
        expect(text(cell!)).toContain("2 hours");
        expect(text(cell!)).toContain("pamWindowRange");
      });

      it("rounds a ragged window up to whole minutes rather than naming seconds", () => {
        jest.setSystemTime(new Date("2026-08-20T09:00:00.000Z"));
        pendingRows$.next([
          requestRow({
            id: "req-ragged",
            status: "pending",
            leaseNotBefore: "2026-08-20T12:00:00.000Z",
            leaseNotAfter: "2026-08-20T12:15:43.000Z",
          }),
        ]);
        create();

        const row = text(rows()[0]);
        expect(row).toContain("16 minutes");
        expect(row).not.toContain("second");
      });

      it("states the window range on the 12-hour clock", () => {
        jest.setSystemTime(new Date("2026-08-20T00:30:00.000Z"));
        const opens = new Date("2026-08-20T00:30:00.000Z");
        opens.setHours(14, 11, 0, 0);
        const closes = new Date(opens);
        closes.setHours(16, 11, 0, 0);
        pendingRows$.next([
          requestRow({
            id: "req-meridiem",
            status: "pending",
            leaseNotBefore: opens.toISOString(),
            leaseNotAfter: closes.toISOString(),
          }),
        ]);
        create();

        expect(text(rows()[0]).toLowerCase()).toContain("pm");
      });

      it("names the day of a window scheduled for tomorrow", () => {
        const now = new Date("2026-08-20T11:30:00.000Z");
        jest.setSystemTime(now);
        const opens = new Date(now);
        opens.setDate(opens.getDate() + 1);
        opens.setHours(9, 0, 0, 0);
        const closes = new Date(opens);
        closes.setHours(13, 0, 0, 0);
        pendingRows$.next([
          requestRow({
            id: "req-tomorrow",
            status: "pending",
            leaseNotBefore: opens.toISOString(),
            leaseNotAfter: closes.toISOString(),
          }),
        ]);
        create();

        const row = rows()[0];
        expect(text(row)).toContain("Tomorrow");
        expect(text(row)).toContain("4 hours");
      });

      it("dates a window further out than tomorrow", () => {
        const now = new Date("2026-08-20T11:30:00.000Z");
        jest.setSystemTime(now);
        const opens = new Date(now);
        opens.setDate(opens.getDate() + 5);
        opens.setHours(9, 0, 0, 0);
        const closes = new Date(opens);
        closes.setHours(13, 0, 0, 0);
        pendingRows$.next([
          requestRow({
            id: "req-later",
            status: "pending",
            leaseNotBefore: opens.toISOString(),
            leaseNotAfter: closes.toISOString(),
          }),
        ]);
        create();

        expect(text(rows()[0])).toContain(formatCalendarDate("en-US", opens.getTime()));
      });

      it("leaves a window inside today with bare times", () => {
        const now = new Date("2026-08-20T11:30:00.000Z");
        jest.setSystemTime(now);
        const opens = new Date(now);
        opens.setHours(opens.getHours() + 1, 0, 0, 0);
        const closes = new Date(opens);
        closes.setHours(opens.getHours() + 2, 0, 0, 0);
        pendingRows$.next([
          requestRow({
            id: "req-today",
            status: "pending",
            leaseNotBefore: opens.toISOString(),
            leaseNotAfter: closes.toISOString(),
          }),
        ]);
        create();

        expect(text(rows()[0])).not.toContain("pamWindowOnDay");
      });

      it("keeps a single 'Until' line once the window has already opened", () => {
        leases$.next([leaseRow()]);
        create();

        const row = rows()[0];
        expect(text(row)).toContain("pamWindowOpenUntil");
        expect(text(row)).not.toContain("pamWindowRange");
        expect(text(row)).toContain("1 hour");
      });

      it("reveals the actions on row hover or keyboard focus", () => {
        leases$.next([leaseRow()]);
        create();

        const actions = query('[data-testid="my-access-end-lease-1"]')!.parentElement!;
        expect(actions.className).toContain("tw-opacity-[var(--bit-hover-reveal,1)]");
        expect(actions.closest("bit-row")?.className).toContain("[--bit-hover-reveal:0]");
      });
    });

    /**
     * `window` is a synthetic column, so without an explicit comparator the table sorts on a
     * property that does not exist and the header silently does nothing. The rows are built in
     * window-END order, so the fixtures below deliberately disagree on window START, otherwise
     * the default order already matches and the assertion cannot tell the two apart.
     */
    it("sorts the Requested window column when its header is clicked", () => {
      pendingRows$.next([
        requestRow({
          id: "req-starts-late",
          status: "pending",
          leaseNotBefore: "2026-08-20T18:00:00.000Z",
          leaseNotAfter: "2026-08-20T19:00:00.000Z",
        }),
        requestRow({
          id: "req-starts-early",
          status: "pending",
          leaseNotBefore: "2026-08-20T14:00:00.000Z",
          leaseNotAfter: "2026-08-20T20:00:00.000Z",
        }),
      ]);
      create();

      // Built end-ascending: the later-starting row leads until the column is sorted.
      expect(rowIds()).toEqual([
        "my-access-request-req-starts-late",
        "my-access-request-req-starts-early",
      ]);

      const header = queryAll(table(), '[role="columnheader"]').find(
        (h) => text(h) === "pamColumnRequestedWindow",
      );
      header?.querySelector("button")?.click();
      fixture.detectChanges();

      expect(rowIds()).toEqual([
        "my-access-request-req-starts-early",
        "my-access-request-req-starts-late",
      ]);
    });

    it("sorts by Status by default, closest to lapsing first", () => {
      leases$.next([
        leaseRow({ id: "lease-active", notAfter: "2026-08-20T13:30:00.000Z" }),
        leaseRow({ id: "lease-ending", notAfter: "2026-08-20T11:33:00.000Z" }),
      ]);
      pendingRows$.next([
        requestRow({ id: "req-ready", status: "approved" }),
        requestRow({ id: "req-pending", status: "pending" }),
      ]);
      create();

      expect(rowIds()).toEqual([
        "my-access-lease-lease-ending",
        "my-access-lease-lease-active",
        "my-access-request-req-ready",
        "my-access-request-req-pending",
      ]);
    });

    it("names Start and Cancel for the tooltip and the accessibility tree", () => {
      pendingRows$.next([requestRow({ id: "req-grant", status: "approved" })]);
      create();

      const start = query('[data-testid="my-access-approved-start-req-grant"]')!;
      const cancel = query('[data-testid="my-access-cancel-req-grant"]')!;
      expect(start.getAttribute("title") ?? start.getAttribute("aria-label")).toContain(
        "pamStartLeaseButton",
      );
      expect(cancel.getAttribute("title") ?? cancel.getAttribute("aria-label")).toContain(
        "cancelRequest",
      );
    });

    describe("toolbar", () => {
      it("offers a Status chip and a Shared folders chip, and no Requester chip", () => {
        oneOfEach();
        create();

        expect(chips().map((c) => c.getAttribute("key"))).toEqual(["status", "collection"]);
        expect(chipFor("requester")).toBeUndefined();
      });

      it("labels each chip by its name alone while nothing is selected", () => {
        oneOfEach();
        create();

        const label = (key: string) =>
          text(chipFor(key)!.querySelector<HTMLElement>("button[bit-chip-content]")!);
        expect(label("status")).toBe("pamColumnStatus");
        expect(label("collection")).toBe("sharedFolders");
      });

      it("lists every status, whether or not a row currently holds one", () => {
        oneOfEach();
        create();

        expect(optionLabels(chipFor("status")!)).toEqual([
          "pamAccessBadgePending",
          "pamAccessBadgeReady",
          "pamStatusInUse",
          "pamStatusEndingSoon",
          "pamStatusExpired",
        ]);
      });

      it("drops the toolbar with the table when the caller holds nothing", () => {
        create();

        // Nothing to narrow, so the chips go with the table rather than filtering an empty list.
        expect(chipFor("status")).toBeUndefined();
      });

      it("counts a status no row holds as zero rather than leaving it unset", () => {
        oneOfEach();
        create();

        expect(component["statusCounts"]().get("endingSoon")).toBe(0);
      });

      it("disables the shared folder chip when no row carries a folder", () => {
        pendingRows$.next([requestRow({ status: "pending", collectionName: null })]);
        create();

        const trigger = chipFor("collection")!.querySelector("button[bit-chip-content]");
        expect(trigger?.getAttribute("aria-disabled")).toBe("true");
      });

      it("leaves the shared folder chip usable once a row carries one", () => {
        oneOfEach();
        create();

        const trigger = chipFor("collection")!.querySelector("button[bit-chip-content]");
        expect(trigger?.getAttribute("aria-disabled")).toBeNull();
      });

      it("narrows the table to the selected status", () => {
        oneOfEach();
        create();

        chipControl("status").setValue("pending");
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-pending"]);
      });

      it("narrows the table to the selected shared folder", () => {
        leases$.next([leaseRow()]);
        pendingRows$.next([
          requestRow({
            id: "req-other",
            status: "pending",
            collectionId: "col-2",
            collectionName: "Staging",
          }),
        ]);
        create();

        chipControl("collection").setValue("col-2");
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-other"]);
      });

      it("gives each status option the icon its badge uses", () => {
        oneOfEach();
        create();

        const byValue = new Map(
          component["statusOptions"]().map((o: { value: string; iconTile?: { icon: string } }) => [
            o.value,
            o.iconTile?.icon,
          ]),
        );
        expect(byValue.get("pending")).toBe(ACCESS_BADGE_LOOK.pending.icon);
        expect(byValue.get("ready")).toBe(ACCESS_BADGE_LOOK.ready.icon);
        expect(byValue.get("active")).toBe(ACCESS_BADGE_LOOK.active.icon);
      });

      it("checkboxes the options, rather than offering a single choice", () => {
        oneOfEach();
        create();

        expect(chipFor("status")!.getAttribute("multiple")).not.toBeNull();
        expect(chipFor("collection")!.getAttribute("multiple")).not.toBeNull();
      });

      it("keeps rows matching any selected status", () => {
        oneOfEach();
        create();

        chipControl("status").setValue(["pending", "ready"]);
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-grant", "my-access-request-req-pending"]);
      });

      it("requires a row to satisfy the status and the folder together", () => {
        pendingRows$.next([
          requestRow({ id: "req-a", status: "pending" }),
          requestRow({
            id: "req-b",
            status: "pending",
            collectionId: "col-2",
            collectionName: "Staging",
          }),
        ]);
        create();

        chipControl("status").setValue(["pending"]);
        chipControl("collection").setValue(["col-2"]);
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-b"]);
      });

      it("searches across the item and folder names", () => {
        oneOfEach();
        create();

        component["searchControl"].setValue("waiting");
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-pending"]);
      });

      it("says the caller has no requests when they hold nothing at all", () => {
        create();

        // The lockup replaces the table outright, as it does on Approvals and History.
        expect(query("bit-table-v2")).toBeNull();
        expect(query('[data-testid="my-access-empty"]')).not.toBeNull();
        expect(query('[data-testid="my-access-no-results"]')).toBeNull();
      });

      it("blames the filters, not the account, when rows exist but none match", () => {
        oneOfEach();
        create();

        component["searchControl"].setValue("nothing matches this");
        fixture.detectChanges();

        expect(rowIds()).toEqual([]);
        expect(query('[data-testid="my-access-no-results"]')).not.toBeNull();
        expect(query('[data-testid="my-access-empty"]')).toBeNull();
      });

      it("claims neither while the first read is still running", () => {
        // "You have no requests" is not something an unfinished read can say.
        loading$.next(true);
        create();

        expect(query('[data-testid="my-access-empty"]')).toBeNull();
        expect(query('[data-testid="my-access-no-results"]')).toBeNull();
      });

      it("does not announce a load that failed", () => {
        // The table is just as empty as before, and the shell already raises an error toast.
        loading$.next(true);
        create();
        jest.advanceTimersByTime(1000);
        fixture.detectChanges();

        loadError$.next(new Error("read failed"));
        loading$.next(false);
        fixture.detectChanges();

        expect(component["announceLoaded"]()).toBe(false);
      });

      it("shows a skeleton once the first read has run for a second", () => {
        loading$.next(true);
        create();

        expect(query('[data-testid="my-requests-loading"]')).toBeNull();

        jest.advanceTimersByTime(1000);
        fixture.detectChanges();

        expect(query('[data-testid="my-requests-loading"]')).not.toBeNull();
      });
    });
  });
});
