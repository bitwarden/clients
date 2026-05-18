import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Observable, Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService, ToastService } from "@bitwarden/components";
import {
  LeaseEvent,
  LeaseEventKind,
  LeaseEventService,
  LeaseRequestResponse,
  PamApiService,
} from "@bitwarden/pam";

import {
  PendingBlockState,
  PendingStateComponent,
  formatElapsed,
} from "./pending-state.component";

function makeRequest(overrides: Partial<Record<string, unknown>> = {}): LeaseRequestResponse {
  return new LeaseRequestResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: "user-1",
    Status: "pending",
    RequestedNotBefore: null,
    RequestedNotAfter: null,
    RequestedTtlSeconds: 3600,
    Reason: null,
    SubmittedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ResolvedAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: null,
    ...overrides,
  });
}

describe("PendingStateComponent", () => {
  let fixture: ComponentFixture<PendingStateComponent>;
  let component: PendingStateComponent;
  let pamApi: jest.Mocked<Pick<PamApiService, "cancelLeaseRequest">>;
  let toastService: jest.Mocked<Pick<ToastService, "showToast">>;
  let events$: Subject<LeaseEvent>;

  beforeEach(() => {
    pamApi = { cancelLeaseRequest: jest.fn().mockResolvedValue(undefined) };
    toastService = { showToast: jest.fn() };
    events$ = new Subject<LeaseEvent>();

    TestBed.configureTestingModule({
      imports: [PendingStateComponent],
      providers: [
        { provide: PamApiService, useValue: pamApi },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: { error: jest.fn() } },
        {
          provide: LeaseEventService,
          useValue: {
            events$: (_id: string): Observable<LeaseEvent> => events$.asObservable(),
          },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pendingStateTitle: "Pending approval — submitted $1 ago",
              pendingStateNotified: "Notified",
              pendingStateApproversTbd: "Awaiting approval",
              pendingStateCancelRequest: "Cancel request",
              pendingStateCancelSuccess: "Request cancelled.",
              pendingStateCancelError: "Couldn't cancel.",
              denialStateTitle: "Access denied",
              denialStateNoReason: "Access to this item was denied.",
            }),
        },
      ],
    });

    fixture = TestBed.createComponent(PendingStateComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("request", makeRequest());
    fixture.detectChanges();
  });

  it("renders the pending block by default", () => {
    const block = fixture.debugElement.query(By.css("[data-testid='pending-state-block']"));
    expect(block).toBeTruthy();
  });

  it("does not render the denial block while pending", () => {
    const block = fixture.debugElement.query(By.css("[data-testid='denial-state-block']"));
    expect(block).toBeNull();
  });

  it("shows the elapsed label in the status line", () => {
    const status = fixture.debugElement.query(
      By.css("[data-testid='pending-state-status']"),
    )?.nativeElement as HTMLElement;
    expect(status?.textContent).toBeTruthy();
  });

  it("shows the approver placeholder text", () => {
    const approvers = fixture.debugElement.query(
      By.css("[data-testid='pending-state-approvers']"),
    )?.nativeElement as HTMLElement;
    expect(approvers?.textContent).toContain("Awaiting approval");
  });

  it("flips to denial state and hides pending block on LeaseEventKind.Denied push", async () => {
    events$.next({ kind: LeaseEventKind.Denied, requestId: "req-1" });
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css("[data-testid='denial-state-block']")),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css("[data-testid='pending-state-block']")),
    ).toBeNull();
  });

  it("emits approved output on LeaseEventKind.Approved push", () => {
    let emitted = false;
    component.approved.subscribe(() => (emitted = true));

    events$.next({ kind: LeaseEventKind.Approved, requestId: "req-1" });

    expect(emitted).toBe(true);
  });

  it("calls cancelLeaseRequest and emits cancelled on cancel click", async () => {
    let cancelEmitted = false;
    component.cancelled.subscribe(() => (cancelEmitted = true));

    const cancelBtn = fixture.debugElement.query(
      By.css("[data-testid='pending-state-cancel']"),
    )?.nativeElement as HTMLButtonElement;
    cancelBtn.click();
    await fixture.whenStable();

    expect(pamApi.cancelLeaseRequest).toHaveBeenCalledWith("req-1");
    expect(cancelEmitted).toBe(true);
  });

  it("shows error toast and does not emit on cancelLeaseRequest failure", async () => {
    pamApi.cancelLeaseRequest.mockRejectedValue(new Error("network"));
    let cancelEmitted = false;
    component.cancelled.subscribe(() => (cancelEmitted = true));

    const cancelBtn = fixture.debugElement.query(
      By.css("[data-testid='pending-state-cancel']"),
    )?.nativeElement as HTMLButtonElement;
    cancelBtn.click();
    await fixture.whenStable();

    expect(cancelEmitted).toBe(false);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("shows denial block without reason when denial reason is null", () => {
    events$.next({ kind: LeaseEventKind.Denied, requestId: "req-1" });
    fixture.detectChanges();

    const noReason = fixture.debugElement.query(
      By.css("[data-testid='denial-state-no-reason']"),
    );
    expect(noReason).toBeTruthy();
  });
});

describe("formatElapsed", () => {
  const makeReq = (submittedAt: string) =>
    ({ submittedAt } as Pick<LeaseRequestResponse, "submittedAt">);

  it("returns '0m' when just submitted", () => {
    const now = Date.now();
    expect(formatElapsed(now, makeReq(new Date(now - 30_000).toISOString()))).toBe("0m");
  });

  it("returns minutes for sub-hour elapsed", () => {
    const now = Date.now();
    expect(formatElapsed(now, makeReq(new Date(now - 37 * 60_000).toISOString()))).toBe("37m");
  });

  it("returns hours for elapsed ≥ 60 minutes with no remainder", () => {
    const now = Date.now();
    expect(formatElapsed(now, makeReq(new Date(now - 2 * 60 * 60_000).toISOString()))).toBe("2h");
  });

  it("returns hours and minutes for elapsed with remainder", () => {
    const now = Date.now();
    expect(
      formatElapsed(now, makeReq(new Date(now - (2 * 60 + 15) * 60_000).toISOString())),
    ).toBe("2h 15m");
  });
});
