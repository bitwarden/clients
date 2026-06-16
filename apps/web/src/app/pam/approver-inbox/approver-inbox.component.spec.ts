import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import { AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { HeaderModule } from "../../layouts/header/header.module";
import { AccessRequestNameResolver } from "../access-request-name-resolver.service";
import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxComponent } from "./approver-inbox.component";
import { ApproverInboxService } from "./approver-inbox.service";

// JSDOM has no ResizeObserver; the tab nav bar's overflow list constructs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

function pendingRow(id: string): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: id,
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: "user-2",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-05-15T12:00:00Z",
    CipherName: "Prod DB",
    CollectionName: "Production",
    RequesterName: "Bob",
    RequesterEmail: "bob@example.com",
  });
}

/**
 * The persistent shell only renders the tab nav (with live badge counts) and orchestrates load +
 * live refresh; per-tab views and actions are exercised by the tab-component specs. Loading and
 * live refresh run once here for the whole page, so that is what this spec covers.
 */
describe("ApproverInboxComponent", () => {
  let fixture: ComponentFixture<ApproverInboxComponent>;
  let pamApiService: MockProxy<PamApiService>;
  let toastService: MockProxy<ToastService>;
  let badgeService: MockProxy<ApproverInboxBadgeService>;
  let syncService: { fullSync: jest.Mock };
  let notifications$: Subject<readonly [{ type: NotificationType }, string]>;
  let mutations$: Subject<void>;

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    toastService = mock<ToastService>();
    badgeService = mock<ApproverInboxBadgeService>();

    pamApiService.listInboxRequests.mockResolvedValue([]);
    pamApiService.listInboxHistory.mockResolvedValue([]);
    pamApiService.listMyAccessRequests.mockResolvedValue([]);
    pamApiService.listActiveLeases.mockResolvedValue([]);

    notifications$ = new Subject();
    mutations$ = new Subject();
    (pamApiService as unknown as { mutations$: Subject<void> }).mutations$ = mutations$;
    const notificationsService = mock<ServerNotificationsService>();
    (notificationsService as unknown as { notifications$: typeof notifications$ }).notifications$ =
      notifications$;

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    const nameResolver = mock<AccessRequestNameResolver>();
    nameResolver.resolveDisplayNames.mockResolvedValue({
      cipherNameById: new Map(),
      collectionNameById: new Map(),
      cipherById: new Map(),
    });
    nameResolver.namesFor.mockResolvedValue({
      cipherNameById: new Map(),
      collectionNameById: new Map(),
      cipherById: new Map(),
    });
    nameResolver.applyCollectionNames$.mockImplementation((rows$) => rows$);

    syncService = { fullSync: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ApproverInboxComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        // Real page-scoped services (their only dependencies — the API + name resolver — are mocked)
        // so the shell's badge counts and load orchestration run against the same instances the tabs
        // would share at the route level.
        ApproverInboxService,
        MyAccessRequestsService,
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ApproverInboxBadgeService, useValue: badgeService },
        { provide: ServerNotificationsService, useValue: notificationsService },
        { provide: SyncService, useValue: syncService },
      ],
    })
      .overrideComponent(ApproverInboxComponent, {
        remove: { imports: [HeaderModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ApproverInboxComponent);
  });

  const init = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("renders the three tab links", async () => {
    await init();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("pamTabApprovals");
    expect(text).toContain("pamTabMyRequests");
    expect(text).toContain("pamTabAuditLog");
  });

  it("kicks a sync and loads both services on init", async () => {
    await init();
    expect(syncService.fullSync).toHaveBeenCalledWith(false);
    expect(pamApiService.listInboxRequests).toHaveBeenCalled();
    expect(pamApiService.listMyAccessRequests).toHaveBeenCalled();
    expect(badgeService.refresh).toHaveBeenCalled();
  });

  it("surfaces the pending-approval count for the Approvals tab berry", async () => {
    pamApiService.listInboxRequests.mockResolvedValue([pendingRow("a"), pendingRow("b")]);
    await init();
    const count = (
      fixture.componentInstance as unknown as { pendingApprovalsCount: () => number }
    ).pendingApprovalsCount();
    expect(count).toBe(2);
  });

  it("reloads when a RefreshApproverInbox push arrives", async () => {
    await init();
    pamApiService.listInboxRequests.mockClear();

    notifications$.next([{ type: NotificationType.RefreshApproverInbox }, "user-current"]);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();

    expect(pamApiService.listInboxRequests).toHaveBeenCalled();
  });

  it("reloads when a RefreshAccessRequest push arrives", async () => {
    await init();
    pamApiService.listMyAccessRequests.mockClear();

    notifications$.next([{ type: NotificationType.RefreshAccessRequest }, "user-current"]);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();

    expect(pamApiService.listMyAccessRequests).toHaveBeenCalled();
  });

  it("shows an error toast when the initial load fails", async () => {
    pamApiService.listInboxRequests.mockRejectedValue(new Error("boom"));
    await init();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "pamInboxLoadFailed" }),
    );
  });
});
