import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const LEASE_END = "2026-08-20T12:00:00.000Z";

// Overrides are loosely typed rather than `Partial<MyAccessLeaseRow>`: the row's ids are opaque
// branded types, so tests stand in plain strings and rely on the single cast below — the same
// convention as `history-tab.component.spec.ts`.
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

    await TestBed.configureTestingModule({
      imports: [MyRequestsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: MyAccessService, useValue: myAccess },
        { provide: DialogService, useValue: mock<DialogService>() },
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
});
