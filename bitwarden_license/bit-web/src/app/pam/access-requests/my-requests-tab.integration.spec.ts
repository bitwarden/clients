import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessLeaseView,
  AccessRefreshService,
  AccessRequestSdkService,
  AccessRequestView,
} from "..";

import { AccessNameResolverService, ResolvedNames } from "./access-name-resolver.service";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const HOUR = 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function request(id: string, overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id,
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "pending",
    reason: "Because",
    submittedAt: iso(-HOUR),
    resolvedAt: undefined,
    resolvedBy: undefined,
    leaseNotBefore: iso(-HOUR),
    leaseNotAfter: iso(4 * HOUR),
    producedLeaseId: undefined,
    producedLeaseStatus: undefined,
    extensionOfLeaseId: undefined,
    decisions: [],
    ...overrides,
  } as unknown as AccessRequestView;
}

function lease(id: string, overrides: Record<string, unknown> = {}): AccessLeaseView {
  return {
    id,
    requestId: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "active",
    notBefore: iso(-HOUR),
    notAfter: iso(2 * HOUR),
    termination: undefined,
    ...overrides,
  } as unknown as AccessLeaseView;
}

function names(): ResolvedNames {
  return {
    cipherNameById: new Map([["cipher-1", "Prod database"]]),
    collectionNameById: new Map([["col-1", "Production"]]),
    organizationNameById: new Map([["org-1", "Acme"]]),
    cipherById: new Map(),
  } as unknown as ResolvedNames;
}

describe("MyRequestsTabComponent (through the real MyAccessService)", () => {
  let fixture: ComponentFixture<MyRequestsTabComponent>;
  let requestsApi: ReturnType<typeof mock<AccessRequestSdkService>>;
  let leasesApi: ReturnType<typeof mock<AccessLeaseSdkService>>;
  let accessRefresh: ReturnType<typeof mock<AccessRefreshService>>;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let push$: Subject<void>;

  beforeEach(async () => {
    push$ = new Subject<void>();
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    accessRefresh = mock<AccessRefreshService>();
    dialogService = mock<DialogService>();

    requestsApi.listMyAccessRequests.mockResolvedValue([]);
    leasesApi.listMyLeases.mockResolvedValue([]);
    dialogService.openSimpleDialog.mockResolvedValue(true);

    const nameResolver = mock<AccessNameResolverService>();
    nameResolver.resolveNames.mockResolvedValue(names());

    await TestBed.configureTestingModule({
      imports: [MyRequestsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        MyAccessService,
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessNameResolverService, useValue: nameResolver },
        { provide: AccessRefreshService, useValue: accessRefresh },
        { provide: AccessEventService, useValue: { accessChanged$: () => push$.asObservable() } },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(): Promise<void> {
    fixture = TestBed.createComponent(MyRequestsTabComponent);
    fixture.detectChanges();
    await TestBed.inject(MyAccessService).load();
    fixture.detectChanges();
    await settle();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(selector: string): HTMLElement | null {
    return host().querySelector(selector);
  }

  function rowIds(): (string | null)[] {
    return Array.from(
      host().querySelectorAll<HTMLElement>(
        '[data-testid^="my-access-lease-"], [data-testid^="my-access-request-"], [data-testid^="my-access-extension-"]',
      ),
    ).map((el) => el.getAttribute("data-testid"));
  }

  async function click(selector: string): Promise<void> {
    (query(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
    await settle();
  }

  describe("AC 6 — clicking Start", () => {
    it("activates the grant through the SDK and re-reads the lease it minted", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-grant", { status: "approved", resolvedAt: iso(-HOUR) }),
      ]);
      await open();

      expect(query('[data-testid="access-state-badge-ready"]')).not.toBeNull();

      requestsApi.activateAccessRequest.mockResolvedValue(lease("lease-new") as never);
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-grant", {
          status: "approved",
          resolvedAt: iso(-HOUR),
          producedLeaseId: "lease-new",
          producedLeaseStatus: "active",
        }),
      ]);
      leasesApi.listMyLeases.mockResolvedValue([lease("lease-new", { requestId: "req-grant" })]);

      await click('[data-testid="my-access-approved-start-req-grant"]');

      expect(requestsApi.activateAccessRequest).toHaveBeenCalledWith("req-grant");
      expect(query('[data-testid="access-state-badge-active"]')).not.toBeNull();
      expect(query('[data-testid="access-state-badge-ready"]')).toBeNull();
    });

    it("announces the change so every other surface re-reads the same item", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-grant", { status: "approved", resolvedAt: iso(-HOUR) }),
      ]);
      await open();
      requestsApi.activateAccessRequest.mockResolvedValue(lease("lease-new") as never);

      await click('[data-testid="my-access-approved-start-req-grant"]');

      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalled();
    });
  });

  describe("AC 7 — clicking Cancel request", () => {
    it("withdraws it through the SDK and drops the row from the tab", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-pending")]);
      await open();
      expect(rowIds()).toEqual(["my-access-request-req-pending"]);

      await click('[data-testid="my-access-cancel-req-pending"]');

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("req-pending");
      expect(rowIds()).toEqual([]);
      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalled();
    });

    it("puts the row back when the server refuses", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-pending")]);
      requestsApi.cancelAccessRequest.mockRejectedValue(new Error("nope"));
      await open();

      await click('[data-testid="my-access-cancel-req-pending"]');

      expect(rowIds()).toEqual(["my-access-request-req-pending"]);
    });
  });

  describe("AC 8 — clicking End access", () => {
    it("ends the lease through the SDK and drops the row from the tab", async () => {
      leasesApi.listMyLeases.mockResolvedValue([lease("lease-1")]);
      await open();
      expect(rowIds()).toEqual(["my-access-lease-lease-1"]);

      await click('[data-testid="my-access-end-lease-1"]');

      expect(leasesApi.endLease).toHaveBeenCalledWith("lease-1", { reason: undefined });
      expect(rowIds()).toEqual([]);
      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalled();
    });

    it("asks before it ends, and does nothing when the requester declines", async () => {
      leasesApi.listMyLeases.mockResolvedValue([lease("lease-1")]);
      dialogService.openSimpleDialog.mockResolvedValue(false);
      await open();

      await click('[data-testid="my-access-end-lease-1"]');

      expect(leasesApi.endLease).not.toHaveBeenCalled();
      expect(rowIds()).toEqual(["my-access-lease-lease-1"]);
    });
  });

  describe("AC 10 — an approver decides", () => {
    it("moves the row to Ready to use when the push says it was approved", fakeAsync(() => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-1")]);
      fixture = TestBed.createComponent(MyRequestsTabComponent);
      fixture.detectChanges();
      void TestBed.inject(MyAccessService).load();
      tick();
      fixture.detectChanges();

      expect(query('[data-testid="access-state-badge-pending"]')).not.toBeNull();

      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", { status: "approved", resolvedAt: iso(-60_000) }),
      ]);
      push$.next();
      tick();
      fixture.detectChanges();

      expect(query('[data-testid="access-state-badge-ready"]')).not.toBeNull();
    }));

    it("takes the row out of the tab when the push says it was denied", fakeAsync(() => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-1")]);
      fixture = TestBed.createComponent(MyRequestsTabComponent);
      fixture.detectChanges();
      void TestBed.inject(MyAccessService).load();
      tick();
      fixture.detectChanges();
      expect(rowIds()).toEqual(["my-access-request-req-1"]);

      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", { status: "denied", resolvedAt: iso(-60_000) }),
      ]);
      push$.next();
      tick();
      fixture.detectChanges();

      expect(rowIds()).toEqual([]);
    }));
  });

  describe("AC 11 — counts follow the rows", () => {
    it("re-counts the item total and the Status options when a row leaves", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-a"),
        request("req-b", { id: "req-b" }),
      ]);
      await open();

      const counts = () =>
        (
          fixture.componentInstance as unknown as {
            statusCounts: () => ReadonlyMap<string, number>;
          }
        ).statusCounts();
      expect(counts().get("pending")).toBe(2);

      await click('[data-testid="my-access-cancel-req-a"]');

      expect(counts().get("pending")).toBe(1);
      expect(rowIds()).toEqual(["my-access-request-req-b"]);
    });
  });
});
