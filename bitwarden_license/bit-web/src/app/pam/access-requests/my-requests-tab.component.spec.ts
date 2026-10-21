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

import { ACCESS_BADGE_LOOK } from "../access-state-badge/access-badge-state";

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
  let myAccess: {
    pendingRows$: BehaviorSubject<MyAccessRequestRow[]>;
    extensionRows$: BehaviorSubject<MyAccessRequestRow[]>;
    leases$: BehaviorSubject<MyAccessLeaseRow[]>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    activate: jest.Mock;
    cancel: jest.Mock;
    endLease: jest.Mock;
  };
  let toastService: MockProxy<ToastService>;
  let dialogService: MockProxy<DialogService>;
  let configService: MockProxy<ConfigService>;

  function create(): void {
    fixture = TestBed.createComponent(MyRequestsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function activeAccessRowIds(): (string | null)[] {
    const rows = fixture.nativeElement.querySelectorAll(
      'tr[data-testid^="my-access-lease-"], tr[data-testid^="my-access-approved-"]',
    ) as NodeListOf<HTMLElement>;
    return [...rows].map((row) => row.getAttribute("data-testid"));
  }

  function sortActiveAccessByItem(): void {
    const anyRow = fixture.nativeElement.querySelector(
      'tr[data-testid^="my-access-lease-"], tr[data-testid^="my-access-approved-"]',
    ) as HTMLElement;
    const header = anyRow
      .closest("table")!
      .querySelector("th[bitSortable] button") as HTMLButtonElement;
    header.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
    pendingRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    extensionRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    leases$ = new BehaviorSubject<MyAccessLeaseRow[]>([]);
    myAccess = {
      pendingRows$,
      extensionRows$,
      leases$,
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      activate: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      endLease: jest.fn().mockResolvedValue(undefined),
    };
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [MyRequestsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: MyAccessService, useValue: myAccess },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: ConfigService, useValue: configService },
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

  describe("Extension requests section", () => {
    it("does not render when there are no open extension requests", () => {
      create();

      expect(query('[data-testid="my-access-extension-req-ext"]')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain("pamMyRequestsGroupExtensions");
    });

    it("renders the accordion and its row once an extension request is open", () => {
      extensionRows$.next([requestRow({ id: "req-ext", status: "pending" })]);
      create();

      expect(fixture.nativeElement.textContent).toContain("pamMyRequestsGroupExtensions");
      expect(query('[data-testid="my-access-extension-req-ext"]')).not.toBeNull();
    });
  });

  describe("Pending section empty state", () => {
    it("shows the empty-state message when there is nothing pending", () => {
      create();

      expect(query('[data-testid="my-access-pending-empty"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain("pamMyRequestsPendingEmpty");
    });
  });

  describe("Active access section", () => {
    it("renders the section title", () => {
      create();

      expect(fixture.nativeElement.textContent).toContain("pamMyRequestsActiveAccessSection");
    });

    it("shows the empty-state message when no access is active", () => {
      create();

      expect(query('[data-testid="my-access-active-empty"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain("pamMyRequestsActiveAccessEmpty");
    });
  });

  describe("grouping an approved request", () => {
    beforeEach(() => {});

    it("renders an approved, unactivated request with the active access rather than Pending", () => {
      pendingRows$.next([requestRow(), requestRow({ id: "req-pending", status: "pending" })]);

      create();

      expect(query('[data-testid="my-access-approved-req-1"]')).not.toBeNull();
      expect(query('[data-testid="my-access-pending-req-1"]')).toBeNull();
      expect(query('[data-testid="my-access-pending-req-pending"]')).not.toBeNull();
    });

    it("counts undecided rows under Pending and approved rows with the active access", () => {
      pendingRows$.next([requestRow(), requestRow({ id: "req-pending", status: "pending" })]);
      leases$.next([leaseRow()]);

      create();

      expect(query('[data-testid="my-access-pending-count"]')!.textContent).toContain("1");
      expect(query('[data-testid="my-access-active-count"]')!.textContent).toContain("2");
    });

    it("never renders a Start button inside the Pending table", () => {
      pendingRows$.next([requestRow(), requestRow({ id: "req-pending", status: "pending" })]);

      create();

      expect(query('[data-testid^="my-access-pending-start-"]')).toBeNull();
      expect(query('[data-testid="my-access-approved-start-req-1"]')).not.toBeNull();
    });

    it("badges a grant inside its window 'Ready to use'", () => {
      pendingRows$.next([requestRow()]);

      create();

      expect(query('[data-testid="access-state-badge-ready"]')).not.toBeNull();
    });

    it("badges a grant scheduled for later 'Ready to use'", () => {
      pendingRows$.next([requestRow({ leaseNotBefore: "2026-08-21T11:30:00.000Z" })]);

      create();

      expect(query('[data-testid="access-state-badge-ready"]')).not.toBeNull();
      expect(query('[data-testid="my-access-approved-status-req-1"]')).toBeNull();
    });

    it("keeps a grant whose window has lapsed visible, with nothing to start or cancel", () => {
      pendingRows$.next([requestRow({ leaseNotAfter: "2026-08-19T11:30:00.000Z" })]);

      create();

      expect(query('[data-testid="my-access-approved-req-1"]')).not.toBeNull();
      expect(query('[data-testid="access-state-badge-ready"]')).toBeNull();
      expect(query('[data-testid="my-access-approved-start-req-1"]')).toBeNull();
      expect(query('[data-testid="my-access-approved-cancel-req-1"]')).toBeNull();
    });

    it("badges a grant whose window has lapsed Expired rather than Approved", () => {
      pendingRows$.next([requestRow({ leaseNotAfter: "2026-08-19T11:30:00.000Z" })]);

      create();

      const status = query('[data-testid="my-access-approved-status-req-1"]')!;
      expect(status.textContent).toContain("pamStatusExpired");
      expect(status.textContent).not.toContain("pamStatusApproved");
    });

    it("drops the open-ended 'Until' window once a grant can no longer be started", () => {
      pendingRows$.next([requestRow({ leaseNotAfter: "2026-08-19T11:30:00.000Z" })]);

      create();

      const row = query('[data-testid="my-access-approved-req-1"]')!;
      expect(row.textContent).not.toContain("pamWindowUntil");
    });

    it("orders held access soonest-ending first, ahead of grants awaiting activation", () => {
      pendingRows$.next([
        requestRow({ id: "req-lapsed", leaseNotAfter: "2026-08-19T11:30:00.000Z" }),
      ]);
      leases$.next([
        leaseRow({ id: "lease-late", notAfter: "2026-08-20T18:00:00.000Z" }),
        leaseRow({ id: "lease-soon" }),
      ]);

      create();

      expect(activeAccessRowIds()).toEqual([
        "my-access-lease-lease-soon",
        "my-access-lease-lease-late",
        "my-access-approved-req-lapsed",
      ]);
    });

    it("shows the Pending empty state when the only request is approved", () => {
      pendingRows$.next([requestRow()]);

      create();

      expect(query('[data-testid="my-access-pending-empty"]')).not.toBeNull();
      expect(query('[data-testid="my-access-approved-req-1"]')).not.toBeNull();
    });
  });

  describe("sorting the active access by item", () => {
    beforeEach(() => {
      pendingRows$.next([
        requestRow({ id: "req-alpha", cipherName: "Alpha DB" }),
        requestRow({ id: "req-zebra", cipherName: "Zebra DB" }),
      ]);
      leases$.next([leaseRow({ id: "lease-1", cipherName: "Prod database" })]);
    });

    it("keeps held access ahead of grants when sorted A to Z", () => {
      create();

      sortActiveAccessByItem();

      expect(activeAccessRowIds()).toEqual([
        "my-access-lease-lease-1",
        "my-access-approved-req-alpha",
        "my-access-approved-req-zebra",
      ]);
    });

    it("keeps held access ahead of grants when the sort is reversed", () => {
      create();

      sortActiveAccessByItem();
      sortActiveAccessByItem();

      expect(activeAccessRowIds()).toEqual([
        "my-access-lease-lease-1",
        "my-access-approved-req-zebra",
        "my-access-approved-req-alpha",
      ]);
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

  describe("with the VFO1 flag on", () => {
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
      createWithFlag(true);

      expect(queryAll(fixture.nativeElement, "bit-table-v2")).toHaveLength(1);
      expect(queryAll(fixture.nativeElement, "bit-accordion")).toHaveLength(0);
    });

    it("keeps the sectioned v1 layout with the flag off", () => {
      oneOfEach();
      createWithFlag(false);

      expect(queryAll(fixture.nativeElement, "bit-table-v2")).toHaveLength(0);
      expect(queryAll(fixture.nativeElement, "bit-accordion").length).toBeGreaterThan(0);
    });

    it("renders the designed columns in order, with Actions named but hidden", () => {
      oneOfEach();
      createWithFlag(true);

      expect(headings()).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamColumnRequestedWindow",
        "pamColumnActions",
      ]);
      const actionsHeader = queryAll(table(), '[role="columnheader"], th').at(-1)!;
      expect(actionsHeader.querySelector(".tw-sr-only")?.textContent).toContain("pamColumnActions");
    });

    it("lists held access, grants and undecided requests together", () => {
      oneOfEach();
      createWithFlag(true);

      expect(rowIds()).toEqual([
        "my-access-lease-lease-1",
        "my-access-request-req-grant",
        "my-access-request-req-pending",
      ]);
    });

    it("keeps a pending extension visible rather than dropping it with its section", () => {
      extensionRows$.next([requestRow({ id: "req-ext", status: "pending" })]);
      createWithFlag(true);

      expect(rowIds()).toContain("my-access-extension-req-ext");
    });

    it("offers only Cancel on an undecided request", () => {
      pendingRows$.next([requestRow({ id: "req-pending", status: "pending" })]);
      createWithFlag(true);

      expect(query('[data-testid="my-access-cancel-req-pending"]')).not.toBeNull();
      expect(query('[data-testid="my-access-approved-start-req-pending"]')).toBeNull();
    });

    it("offers Start and Cancel on a grant that can still be used", () => {
      pendingRows$.next([requestRow({ id: "req-grant", status: "approved" })]);
      createWithFlag(true);

      expect(query('[data-testid="my-access-approved-start-req-grant"]')).not.toBeNull();
      expect(query('[data-testid="my-access-cancel-req-grant"]')).not.toBeNull();
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
      createWithFlag(true);

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
      createWithFlag(true);

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
      createWithFlag(true);

      expect(query('[data-testid="access-state-badge-ready"]')).not.toBeNull();
      expect(query('[data-testid="my-access-approved-status-req-scheduled"]')).toBeNull();
      expect(component["statusCounts"]().get("ready")).toBe(1);
      expect(query('[data-testid="my-access-approved-start-req-scheduled"]')).toBeNull();
    });

    it("offers only End access on held access", () => {
      leases$.next([leaseRow()]);
      createWithFlag(true);

      expect(query('[data-testid="my-access-end-lease-1"]')).not.toBeNull();
      expect(query('[data-testid="my-access-cancel-lease-1"]')).toBeNull();
    });

    it("withholds both actions on a grant whose window has lapsed", () => {
      pendingRows$.next([
        requestRow({ id: "req-lapsed", status: "approved", leaseNotAfter: "2020-01-01T00:00:00Z" }),
      ]);
      createWithFlag(true);

      expect(query('[data-testid="my-access-approved-start-req-lapsed"]')).toBeNull();
      expect(query('[data-testid="my-access-cancel-req-lapsed"]')).toBeNull();
    });

    it("links each item to its request", () => {
      leases$.next([leaseRow()]);
      createWithFlag(true);

      expect(query("bit-table-v2 a")?.getAttribute("href")).toContain("/pam/requests/req-1");
    });

    describe("the row", () => {
      it("marks the item as organization-owned beside its name", () => {
        leases$.next([leaseRow()]);
        createWithFlag(true);

        const icon = query('bit-table-v2 bit-icon[name="bwi-business"]');
        expect(icon).not.toBeNull();
      });

      it("names the shared folder on the line below, without a glyph", () => {
        leases$.next([leaseRow()]);
        createWithFlag(true);

        const secondary = query('bit-table-v2 [slot="secondary"]');
        expect(secondary?.textContent).toContain("pamInboxInCollection Production");
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
        createWithFlag(true);

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
        createWithFlag(true);

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
        createWithFlag(true);

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
        createWithFlag(true);

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
        createWithFlag(true);

        const expected = new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(opens);
        expect(text(rows()[0])).toContain(expected);
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
        createWithFlag(true);

        expect(text(rows()[0])).not.toContain("pamWindowOnDay");
      });

      it("keeps a single 'Until' line once the window has already opened", () => {
        leases$.next([leaseRow()]);
        createWithFlag(true);

        const row = rows()[0];
        expect(text(row)).toContain("pamWindowUntil");
        expect(text(row)).not.toContain("pamWindowRange");
        expect(text(row)).toContain("1 hour");
      });

      it("reveals the actions on row hover or keyboard focus only", () => {
        leases$.next([leaseRow()]);
        createWithFlag(true);

        const actions = query('[data-testid="my-access-end-lease-1"]')!.parentElement!;
        expect(actions.className).toContain("tw-opacity-0");
        expect(actions.className).toContain("group-hover/row:tw-opacity-100");
        expect(actions.className).toContain("group-has-[:focus-visible]/row:tw-opacity-100");
      });

      it("keeps a hidden action out of the way of the pointer until it is revealed", () => {
        leases$.next([leaseRow()]);
        createWithFlag(true);

        const actions = query('[data-testid="my-access-end-lease-1"]')!.parentElement!;
        expect(actions.className).toContain("tw-pointer-events-none");
        expect(actions.className).toContain("group-hover/row:tw-pointer-events-auto");
      });
    });

    /**
     * `window` is a synthetic column, so without an explicit comparator the table sorts on a
     * property that does not exist and the header silently does nothing. The rows are built in
     * window-END order, so the fixtures below deliberately disagree on window START — otherwise
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
      createWithFlag(true);

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
      createWithFlag(true);

      expect(rowIds()).toEqual([
        "my-access-lease-lease-ending",
        "my-access-lease-lease-active",
        "my-access-request-req-ready",
        "my-access-request-req-pending",
      ]);
    });

    it("names Start and Cancel for the tooltip and the accessibility tree", () => {
      pendingRows$.next([requestRow({ id: "req-grant", status: "approved" })]);
      createWithFlag(true);

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
        createWithFlag(true);

        expect(chips().map((c) => c.getAttribute("key"))).toEqual(["status", "collection"]);
        expect(chipFor("requester")).toBeUndefined();
      });

      it("lists every status, whether or not a row currently holds one", () => {
        oneOfEach();
        createWithFlag(true);

        expect(optionLabels(chipFor("status")!)).toEqual([
          "pamAccessBadgePending",
          "pamAccessBadgeReady",
          "pamMyRequestsStatusInUse",
          "pamMyRequestsStatusEndingSoon",
        ]);
      });

      it("still lists the statuses when there is nothing left to act on", () => {
        createWithFlag(true);

        expect(optionLabels(chipFor("status")!)).toEqual([
          "pamAccessBadgePending",
          "pamAccessBadgeReady",
          "pamMyRequestsStatusInUse",
          "pamMyRequestsStatusEndingSoon",
        ]);
      });

      it("counts a status no row holds as zero rather than leaving it unset", () => {
        oneOfEach();
        createWithFlag(true);

        expect(component["statusCounts"]().get("endingSoon")).toBe(0);
      });

      it("disables the shared folder chip when no row carries a folder", () => {
        pendingRows$.next([requestRow({ status: "pending", collectionName: null })]);
        createWithFlag(true);

        const trigger = chipFor("collection")!.querySelector("button[bit-chip-content]");
        expect(trigger?.getAttribute("aria-disabled")).toBe("true");
      });

      it("leaves the shared folder chip usable once a row carries one", () => {
        oneOfEach();
        createWithFlag(true);

        const trigger = chipFor("collection")!.querySelector("button[bit-chip-content]");
        expect(trigger?.getAttribute("aria-disabled")).toBeNull();
      });

      it("narrows the table to the selected status", () => {
        oneOfEach();
        createWithFlag(true);

        component["statusFilter"]()?.setValue("pending");
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
        createWithFlag(true);

        component["collectionFilter"]()?.setValue("col-2");
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-other"]);
      });

      it("gives each status option the icon its badge uses", () => {
        oneOfEach();
        createWithFlag(true);

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
        createWithFlag(true);

        expect(chipFor("status")!.getAttribute("multiple")).not.toBeNull();
        expect(chipFor("collection")!.getAttribute("multiple")).not.toBeNull();
      });

      it("keeps rows matching any selected status", () => {
        oneOfEach();
        createWithFlag(true);

        component["statusFilter"]()?.setValue(["pending", "ready"]);
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
        createWithFlag(true);

        component["statusFilter"]()?.setValue(["pending"]);
        component["collectionFilter"]()?.setValue(["col-2"]);
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-b"]);
      });

      it("searches across the item and folder names", () => {
        oneOfEach();
        createWithFlag(true);

        component["searchControl"].setValue("waiting");
        fixture.detectChanges();

        expect(rowIds()).toEqual(["my-access-request-req-pending"]);
      });

      it("shows the empty state when nothing is left to act on", () => {
        createWithFlag(true);

        expect(rowIds()).toEqual([]);
        expect(query('[data-testid="my-access-pending-empty"]')).not.toBeNull();
      });
    });
  });
});
