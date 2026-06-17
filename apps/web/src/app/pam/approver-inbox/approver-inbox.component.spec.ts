import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApproverInboxComponent } from "./approver-inbox.component";
import { ApproverInboxService } from "./approver-inbox.service";

// JSDOM has no ResizeObserver; the tab nav bar's overflow list constructs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

/**
 * The persistent shell only renders the tab nav (with live badge counts), kicks a sync to warm
 * vault state, and surfaces an inbox load failure. Loading and live refresh are owned by the
 * page-scoped services (covered by their own specs), so this spec mocks those and covers only the
 * shell's own behaviour.
 */
describe("ApproverInboxComponent", () => {
  let fixture: ComponentFixture<ApproverInboxComponent>;
  let toastService: MockProxy<ToastService>;
  let syncService: { fullSync: jest.Mock };
  let badgeCount$: BehaviorSubject<number>;
  let inboxLoadError$: Subject<unknown>;
  let myPendingCount$: BehaviorSubject<number>;

  beforeEach(async () => {
    toastService = mock<ToastService>();
    syncService = { fullSync: jest.fn().mockResolvedValue(true) };
    badgeCount$ = new BehaviorSubject<number>(0);
    inboxLoadError$ = new Subject<unknown>();
    myPendingCount$ = new BehaviorSubject<number>(0);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [ApproverInboxComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: ApproverInboxService,
          useValue: { badgeCount$, loadError$: inboxLoadError$ },
        },
        { provide: MyAccessRequestsService, useValue: { pendingCount$: myPendingCount$ } },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
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

  it("kicks a sync on init so vault state warms for name resolution", async () => {
    await init();
    expect(syncService.fullSync).toHaveBeenCalledWith(false);
  });

  it("surfaces the pending-approval count for the Approvals tab berry", async () => {
    badgeCount$.next(2);
    await init();
    const count = (
      fixture.componentInstance as unknown as { pendingApprovalsCount: () => number }
    ).pendingApprovalsCount();
    expect(count).toBe(2);
  });

  it("shows an error toast when the inbox stream reports a load failure", async () => {
    await init();

    inboxLoadError$.next(new Error("boom"));

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "pamInboxLoadFailed" }),
    );
  });
});
