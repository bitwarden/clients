import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BitTableV2Component,
  DialogService,
  FilterOptionComponent,
  ToastService,
} from "@bitwarden/components";

import { MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const LEASE_END = "2026-08-20T12:00:00.000Z";

/**
 * The ids of the once-a-second clocks a spied `setInterval` created, told apart from the
 * zero-delay timers Angular's own scheduler queues during change detection.
 */
function secondlyIntervalIds(spy: jest.SpyInstance): unknown[] {
  return spy.mock.results
    .filter((_, index) => spy.mock.calls[index][1] === 1000)
    .map((result) => result.value);
}

// Loosely typed, not `Partial<MyAccessLeaseRow>`, since row ids are opaque branded types (same
// convention as `history-tab.component.spec.ts`).
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

  /** Click the active-access table's Item header, toggling its sort the way a user would. */
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
      jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
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
      jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
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
    beforeEach(() => {
      jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
    });

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

    it("does not claim readiness before the window opens", () => {
      pendingRows$.next([requestRow({ leaseNotBefore: "2026-08-21T11:30:00.000Z" })]);

      create();

      expect(query('[data-testid="access-state-badge-ready"]')).toBeNull();
      expect(query('[data-testid="my-access-approved-status-req-1"]')!.textContent).toContain(
        "pamStatusApproved",
      );
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
      jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
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

    function sectionTable(titleKey: string): HTMLElement | null {
      const section = queryAll(fixture.nativeElement, "bit-accordion").find((accordion) =>
        text(accordion).includes(titleKey),
      );
      return section?.querySelector<HTMLElement>("bit-table, bit-table-v2") ?? null;
    }

    const pendingTable = () => sectionTable("pamMyRequestsPendingSection")!;
    const extensionTable = () => sectionTable("pamMyRequestsGroupExtensions")!;
    const activeTable = () => sectionTable("pamMyRequestsActiveAccessSection")!;

    function headings(table: HTMLElement): string[] {
      return queryAll(table, 'th, [role="columnheader"]').map(text);
    }

    function rowCount(table: HTMLElement): number {
      return queryAll(table, "tr[bitRow], bit-row").length;
    }

    /** Each row's leading test id, read off the v1 `tr` or the v2 Item cell. */
    function rowIds(table: HTMLElement): (string | null)[] {
      return queryAll(table, "tr[bitRow], bit-row").map((row) =>
        (row.matches("[data-testid]") ? row : row.querySelector("[data-testid]"))!.getAttribute(
          "data-testid",
        ),
      );
    }

    function actions(table: HTMLElement): { testId: string | null; label: string }[] {
      return queryAll(table, "button[data-testid]").map((button) => ({
        testId: button.getAttribute("data-testid"),
        label: text(button),
      }));
    }

    function clickSortHeader(table: HTMLElement, heading: string): void {
      const header = queryAll(table, '[role="columnheader"]').find(
        (candidate) => text(candidate) === heading,
      )!;
      (header.querySelector("button") as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    function populate(): void {
      pendingRows$.next([
        requestRow({
          id: "req-pending-old",
          status: "pending",
          submittedAt: "2026-08-17T09:00:00Z",
        }),
        requestRow({
          id: "req-pending-new",
          status: "pending",
          submittedAt: "2026-08-18T09:00:00Z",
        }),
        requestRow({ id: "req-alpha", cipherName: "Alpha DB" }),
        requestRow({ id: "req-lapsed", leaseNotAfter: "2026-08-19T11:30:00.000Z" }),
      ]);
      extensionRows$.next([requestRow({ id: "req-ext", status: "pending" })]);
      leases$.next([
        leaseRow({ id: "lease-late", requestId: "req-late", notAfter: "2026-08-20T18:00:00.000Z" }),
        leaseRow({
          id: "lease-soon",
          extendedBySeconds: 3600,
          extendedUntil: LEASE_END,
        }),
      ]);
    }

    beforeEach(() => {
      jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
    });

    it("renders bit-table-v2 for every section instead of bit-table", () => {
      populate();

      createWithFlag(true);

      expect(pendingTable().tagName).toBe("BIT-TABLE-V2");
      expect(extensionTable().tagName).toBe("BIT-TABLE-V2");
      expect(activeTable().tagName).toBe("BIT-TABLE-V2");
      expect(query("bit-table")).toBeNull();
    });

    it("renders only the v1 tables with the flag off", () => {
      populate();

      createWithFlag(false);

      expect(pendingTable().tagName).toBe("BIT-TABLE");
      expect(extensionTable().tagName).toBe("BIT-TABLE");
      expect(activeTable().tagName).toBe("BIT-TABLE");
      expect(query("bit-table-v2")).toBeNull();
    });

    it("renders the same column headings, in the same order, as the v1 tables", () => {
      populate();
      createWithFlag(false);
      const v1 = [headings(pendingTable()), headings(extensionTable()), headings(activeTable())];

      createWithFlag(true);

      expect(v1).toEqual([
        ["pamColumnItem", "pamColumnRequestedWindow", "pamColumnSubmitted", "pamColumnActions"],
        ["pamColumnItem", "pamColumnRequestedWindow", "pamColumnSubmitted", "pamColumnActions"],
        ["pamColumnItem", "pamColumnWindow", "pamColumnStatus", "pamColumnActions"],
      ]);
      expect([
        headings(pendingTable()),
        headings(extensionTable()),
        headings(activeTable()),
      ]).toEqual(v1);
    });

    it("keeps the Actions heading visually hidden but named, as v1 does", () => {
      populate();

      createWithFlag(true);

      for (const table of [pendingTable(), extensionTable(), activeTable()]) {
        const actionsHeading = queryAll(table, '[role="columnheader"]').at(-1)!;
        expect(actionsHeading.querySelector(".tw-sr-only")?.textContent?.trim()).toBe(
          "pamColumnActions",
        );
      }
    });

    it("renders one row per request and per held or granted access, as v1 does", () => {
      populate();
      createWithFlag(false);
      const v1 = [rowCount(pendingTable()), rowCount(extensionTable()), rowCount(activeTable())];

      createWithFlag(true);

      expect(v1).toEqual([2, 1, 4]);
      expect([
        rowCount(pendingTable()),
        rowCount(extensionTable()),
        rowCount(activeTable()),
      ]).toEqual(v1);
    });

    it("offers the same row actions, in the same order and with the same labels, as v1", () => {
      populate();
      createWithFlag(false);
      const v1 = [actions(pendingTable()), actions(extensionTable()), actions(activeTable())];

      createWithFlag(true);

      expect(v1[2]).toEqual([
        { testId: "my-access-end-lease-soon", label: "pamEndLeaseButton" },
        { testId: "my-access-end-lease-late", label: "pamEndLeaseButton" },
        { testId: "my-access-approved-start-req-alpha", label: "pamStartLeaseButton" },
        { testId: "my-access-approved-cancel-req-alpha", label: "cancel" },
      ]);
      expect([actions(pendingTable()), actions(extensionTable()), actions(activeTable())]).toEqual(
        v1,
      );
    });

    it("withholds Start and Cancel on a lapsed grant and badges it Expired", () => {
      populate();

      createWithFlag(true);

      expect(query('[data-testid="my-access-approved-start-req-lapsed"]')).toBeNull();
      expect(query('[data-testid="my-access-approved-cancel-req-lapsed"]')).toBeNull();
      expect(query('[data-testid="my-access-approved-status-req-lapsed"]')!.textContent).toContain(
        "pamStatusExpired",
      );
      const lapsedRow = query('[data-testid="my-access-approved-req-lapsed"]')!.closest("bit-row")!;
      expect(lapsedRow.textContent).not.toContain("pamWindowUntil");
    });

    it("shows the same cell content as v1", () => {
      populate();

      createWithFlag(true);

      const active = text(activeTable());
      expect(active).toContain("Prod database");
      expect(active).toContain("pamInboxInCollection Production");
      expect(query('[data-testid="my-access-lease-extended-lease-soon"]')).not.toBeNull();
      expect(query('[data-testid="my-access-lease-extended-lease-late"]')).toBeNull();
      expect(query('[data-testid="access-state-badge-ready"]')).not.toBeNull();
      expect(activeTable().querySelectorAll("app-pam-access-state-badge")).toHaveLength(3);
    });

    it("links each item to its request with a real anchor", () => {
      populate();

      createWithFlag(true);

      expect(
        query('[data-testid="my-access-pending-req-pending-new"] a')?.getAttribute("href"),
      ).toBe("/pam/requests/req-pending-new");
      expect(query('[data-testid="my-access-extension-req-ext"] a')?.getAttribute("href")).toBe(
        "/pam/requests/req-ext",
      );
      expect(query('[data-testid="my-access-lease-lease-late"] a')?.getAttribute("href")).toBe(
        "/pam/requests/req-late",
      );
    });

    it("describes Start by the activation deadline it renders", () => {
      populate();

      createWithFlag(true);

      const start = query('[data-testid="my-access-approved-start-req-alpha"]')!;
      const describedBy = start.getAttribute("aria-describedby")!;
      expect(describedBy).toBe("my-access-approved-deadline-req-alpha");
      expect(fixture.nativeElement.querySelector(`#${describedBy}`)).not.toBeNull();
    });

    it("sorts Pending newest submitted first by default, as v1 does", () => {
      populate();
      createWithFlag(false);
      const v1 = rowIds(pendingTable());

      createWithFlag(true);

      expect(v1).toEqual([
        "my-access-pending-req-pending-new",
        "my-access-pending-req-pending-old",
      ]);
      expect(rowIds(pendingTable())).toEqual(v1);
    });

    it("keeps held access soonest-ending first, ahead of grants, when unsorted, as v1 does", () => {
      populate();
      createWithFlag(false);
      const v1 = rowIds(activeTable());

      createWithFlag(true);

      expect(v1).toEqual([
        "my-access-lease-lease-soon",
        "my-access-lease-lease-late",
        "my-access-approved-req-lapsed",
        "my-access-approved-req-alpha",
      ]);
      expect(rowIds(activeTable())).toEqual(v1);
    });

    it("keeps held access ahead of grants in both directions of the Item sort", () => {
      pendingRows$.next([
        requestRow({ id: "req-alpha", cipherName: "Alpha DB" }),
        requestRow({ id: "req-zebra", cipherName: "Zebra DB" }),
      ]);
      leases$.next([leaseRow({ id: "lease-1", cipherName: "Prod database" })]);
      createWithFlag(true);

      clickSortHeader(activeTable(), "pamColumnItem");
      expect(rowIds(activeTable())).toEqual([
        "my-access-lease-lease-1",
        "my-access-approved-req-alpha",
        "my-access-approved-req-zebra",
      ]);

      clickSortHeader(activeTable(), "pamColumnItem");
      expect(rowIds(activeTable())).toEqual([
        "my-access-lease-lease-1",
        "my-access-approved-req-zebra",
        "my-access-approved-req-alpha",
      ]);
    });

    it("leaves Window and Status unsortable, as v1 does", () => {
      populate();

      createWithFlag(true);

      const sortable = queryAll(activeTable(), '[role="columnheader"]')
        .filter((header) => header.querySelector("button") != null)
        .map(text);
      expect(sortable).toEqual(["pamColumnItem"]);
      expect(
        queryAll(pendingTable(), '[role="columnheader"]')
          .filter((header) => header.querySelector("button") != null)
          .map(text),
      ).toEqual(["pamColumnItem", "pamColumnSubmitted"]);
    });

    it("applies the toolbar search to every v2 table", () => {
      populate();
      createWithFlag(true);

      component["searchControl"].setValue("alpha");
      fixture.detectChanges();

      expect(rowIds(pendingTable())).toEqual([]);
      expect(rowIds(activeTable())).toEqual(["my-access-approved-req-alpha"]);
      expect(query('[data-testid="my-access-pending-empty"]')).not.toBeNull();
    });

    it("keeps the Pending empty state inside its table, and the Active one outside", () => {
      createWithFlag(true);

      expect(query('[data-testid="my-access-pending-empty"]')?.closest("bit-table-v2")).toBe(
        pendingTable(),
      );
      expect(query('[data-testid="my-access-active-empty"]')?.closest("bit-table-v2")).toBeNull();
      expect(queryAll(fixture.nativeElement, "bit-table-v2")).toHaveLength(1);
    });

    it("routes Start, Cancel and End through the same component actions as v1", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      populate();
      createWithFlag(true);

      query('[data-testid="my-access-approved-start-req-alpha"]')!.click();
      query('[data-testid="my-access-pending-cancel-req-pending-new"]')!.click();
      query('[data-testid="my-access-extension-cancel-req-ext"]')!.click();
      query('[data-testid="my-access-end-lease-soon"]')!.click();
      await jest.advanceTimersByTimeAsync(0);

      expect(myAccess.activate).toHaveBeenCalledWith("req-alpha");
      expect(myAccess.cancel).toHaveBeenCalledWith("req-pending-new");
      expect(myAccess.cancel).toHaveBeenCalledWith("req-ext");
      expect(myAccess.endLease).toHaveBeenCalledWith("lease-soon");
    });

    describe("toolbar", () => {
      function chips(root: ParentNode): HTMLElement[] {
        return queryAll(root, "bit-filter-menu");
      }

      function optionLabels(chip: HTMLElement): string[] {
        return queryAll(chip, "bit-filter-option").map(text);
      }

      function searchPlaceholder(): string | null | undefined {
        return query("bit-search input")?.getAttribute("placeholder");
      }

      /** A section's row ids, or null when the section renders no table at all. */
      function sectionRowIds(titleKey: string): (string | null)[] | null {
        const table = sectionTable(titleKey);
        return table ? rowIds(table) : null;
      }

      function allSectionRowIds(): ((string | null)[] | null)[] {
        return [
          sectionRowIds("pamMyRequestsPendingSection"),
          sectionRowIds("pamMyRequestsGroupExtensions"),
          sectionRowIds("pamMyRequestsActiveAccessSection"),
        ];
      }

      function selectCollection(value: string): void {
        component["collectionFilter"]()?.setValue(value);
        fixture.detectChanges();
      }

      /** One row per section in each of two collections, so the chip can narrow all three. */
      function twoCollections(): void {
        pendingRows$.next([
          requestRow({ id: "req-prod", status: "pending" }),
          requestRow({
            id: "req-staging",
            status: "pending",
            cipherName: "Staging DB",
            collectionId: "col-2",
            collectionName: "Staging",
          }),
        ]);
        extensionRows$.next([
          requestRow({ id: "req-ext-prod", status: "pending" }),
          requestRow({
            id: "req-ext-staging",
            status: "pending",
            cipherName: "Staging DB",
            collectionId: "col-2",
            collectionName: "Staging",
          }),
        ]);
        leases$.next([
          leaseRow({ id: "lease-prod" }),
          leaseRow({
            id: "lease-staging",
            requestId: "req-l2",
            cipherName: "Staging DB",
            collectionId: "col-2",
            collectionName: "Staging",
          }),
        ]);
      }

      it("projects the search and the collection chip into the Pending table's toolbar", () => {
        twoCollections();

        createWithFlag(true);

        const toolbar = query("bit-table-toolbar");
        expect(toolbar).not.toBeNull();
        expect(toolbar?.closest("bit-table-v2")).toBe(pendingTable());
        expect(toolbar?.querySelector("bit-search")).not.toBeNull();
        expect(chips(toolbar as HTMLElement)).toHaveLength(1);
        expect(queryAll(fixture.nativeElement, "bit-search")).toHaveLength(1);
        expect(chips(fixture.nativeElement)).toHaveLength(1);
      });

      it("leaves the controls above the accordion group with the flag off", () => {
        twoCollections();

        createWithFlag(false);

        expect(query("bit-table-toolbar")).toBeNull();
        const search = query("bit-search");
        expect(search?.closest("bit-accordion-group")).toBeNull();
        expect(chips(fixture.nativeElement)).toHaveLength(1);
      });

      it("keeps the search placeholder the v1 toolbar rendered", () => {
        twoCollections();

        createWithFlag(false);
        const v1Placeholder = searchPlaceholder();

        createWithFlag(true);

        expect(v1Placeholder?.trim()).toBe("pamAccessRequestsSearchPlaceholder");
        expect(searchPlaceholder()).toBe(v1Placeholder);
      });

      it("keeps the chip's key, label and options", () => {
        twoCollections();

        createWithFlag(false);
        const v1Options = optionLabels(chips(fixture.nativeElement)[0]);
        const v1Label = text(chips(fixture.nativeElement)[0]);

        createWithFlag(true);

        expect(component["collectionOptions"]()).toEqual([
          { value: "col-1", label: "Production" },
          { value: "col-2", label: "Staging" },
        ]);
        expect(optionLabels(chips(fixture.nativeElement)[0])).toEqual(v1Options);
        expect(text(chips(fixture.nativeElement)[0])).toBe(v1Label);
        expect(component["collectionFilter"]()?.key()).toBe("collection");
      });

      it("starts with the chip unset, listing every section in full, as v1 does", () => {
        twoCollections();

        createWithFlag(true);

        expect(component["collectionFilter"]()?.active()).toBe(false);
        expect(allSectionRowIds().map((ids) => ids?.length)).toEqual([2, 2, 2]);
      });

      it("narrows every section from the chip, exactly as v1 does", () => {
        twoCollections();

        createWithFlag(false);
        selectCollection("col-2");
        const v1 = allSectionRowIds();

        createWithFlag(true);
        selectCollection("col-2");

        expect(v1).toEqual([
          ["my-access-pending-req-staging"],
          ["my-access-extension-req-ext-staging"],
          ["my-access-lease-lease-staging"],
        ]);
        expect(allSectionRowIds()).toEqual(v1);
      });

      it("intersects the chip with the search term, as v1 does", () => {
        twoCollections();
        createWithFlag(true);

        // Either control alone leaves rows; together they must leave none.
        selectCollection("col-1");
        component["searchControl"].setValue("staging");
        fixture.detectChanges();

        expect(rowIds(pendingTable())).toEqual([]);
        expect(sectionTable("pamMyRequestsGroupExtensions")).toBeNull();
        expect(query('[data-testid="my-access-pending-empty"]')).not.toBeNull();
        expect(query('[data-testid="my-access-active-empty"]')).not.toBeNull();
      });

      it("counts each chip option absolutely, not against the other controls", () => {
        twoCollections();
        createWithFlag(true);

        const table = fixture.debugElement.query(By.directive(BitTableV2Component))
          .componentInstance as { optionCount(key: string, value: unknown): number | undefined };
        expect(table.optionCount("collection", "col-1")).toBe(1);
        expect(table.optionCount("collection", "col-2")).toBe(1);

        component["searchControl"].setValue("staging");
        fixture.detectChanges();

        expect(table.optionCount("collection", "col-1")).toBe(1);
      });

      it("counts a chip option over every section it narrows, not over Pending alone", () => {
        pendingRows$.next([requestRow({ id: "req-prod", status: "pending" })]);
        leases$.next([
          leaseRow({
            id: "lease-staging",
            requestId: "req-l2",
            cipherName: "Staging DB",
            collectionId: "col-2",
            collectionName: "Staging",
          }),
        ]);

        createWithFlag(true);

        const options = fixture.debugElement
          .queryAll(By.directive(FilterOptionComponent))
          .map((de) => de.componentInstance as FilterOptionComponent<string>);
        expect(options.map((option) => [option.value(), option.count()])).toEqual([
          ["col-1", 1],
          ["col-2", 1],
        ]);

        const table = fixture.debugElement.query(By.directive(BitTableV2Component))
          .componentInstance as { optionCount(key: string, value: unknown): number | undefined };
        expect(table.optionCount("collection", "col-2")).toBe(0);
      });

      it("holds the toolbar in place while Pending has nothing to show", () => {
        leases$.next([leaseRow()]);

        createWithFlag(true);

        expect(rowIds(pendingTable())).toEqual([]);
        expect(query("bit-table-toolbar")?.closest("bit-table-v2")).toBe(pendingTable());
        expect(query('[data-testid="my-access-pending-empty"]')).not.toBeNull();
      });
    });
  });
});
