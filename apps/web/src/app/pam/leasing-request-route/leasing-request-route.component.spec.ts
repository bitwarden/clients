import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import { InboxLeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import { LeasingRequestRouteComponent } from "./leasing-request-route.component";

const REQUEST_ID = "req-deep-link-1";
const CURRENT_USER = "user-approver";

function makeRequest(): InboxLeaseRequestResponse {
  return new InboxLeaseRequestResponse({
    Id: REQUEST_ID,
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: "user-requester",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-05-15T12:00:00Z",
    RequestedNotBefore: null,
    RequestedNotAfter: null,
    Reason: "Incident response",
    CipherName: "Prod DB admin",
    CollectionName: "Production",
    RequesterName: "Bob",
    RequesterEmail: "bob@example.com",
  });
}

describe("LeasingRequestRouteComponent", () => {
  let fixture: ComponentFixture<LeasingRequestRouteComponent>;
  let pamApiService: MockProxy<PamApiService>;
  let authService: MockProxy<AuthService>;
  let toastService: MockProxy<ToastService>;
  let router: Router;

  async function createComponent(
    authStatus: AuthenticationStatus = AuthenticationStatus.Locked,
    pamResolves = true,
  ) {
    pamApiService = mock<PamApiService>();
    authService = mock<AuthService>();
    toastService = mock<ToastService>();

    authService.getAuthStatus.mockResolvedValue(authStatus);

    if (pamResolves) {
      pamApiService.getLeaseRequest.mockResolvedValue(makeRequest());
    } else {
      pamApiService.getLeaseRequest.mockRejectedValue(new Error("network error"));
    }

    const accountService = mock<AccountService>();
    (accountService as unknown as { activeAccount$: BehaviorSubject<unknown> }).activeAccount$ =
      new BehaviorSubject({
        id: CURRENT_USER,
        email: "me@example.com",
        emailVerified: true,
        name: "Me",
      });

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [LeasingRequestRouteComponent, RouterTestingModule],
      providers: [
        { provide: PamApiService, useValue: pamApiService },
        { provide: AuthService, useValue: authService },
        { provide: AccountService, useValue: accountService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { id: REQUEST_ID } } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    fixture = TestBed.createComponent(LeasingRequestRouteComponent);
  }

  describe("when vault is Locked (approval-only surface)", () => {
    beforeEach(async () => {
      await createComponent(AuthenticationStatus.Locked);
    });

    it("calls getLeaseRequest with the route id", async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(pamApiService.getLeaseRequest).toHaveBeenCalledWith(REQUEST_ID);
    });

    it("renders the email-approval component with the fetched request", async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.debugElement.query(
        By.css('[data-testid="leasing-request-email-approval"]'),
      );
      expect(el).not.toBeNull();
    });

    it("does NOT redirect to the approver inbox", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(router.navigate).not.toHaveBeenCalledWith(
        ["/pam/approver-inbox"],
        expect.anything(),
      );
    });
  });

  describe("when vault is Unlocked (redirect to inbox detail)", () => {
    beforeEach(async () => {
      await createComponent(AuthenticationStatus.Unlocked);
    });

    it("redirects to /pam/approver-inbox with the requestId query param", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledWith(["/pam/approver-inbox"], {
        queryParams: { requestId: REQUEST_ID },
        replaceUrl: true,
      });
    });

    it("does NOT call getLeaseRequest", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(pamApiService.getLeaseRequest).not.toHaveBeenCalled();
    });
  });

  describe("when vault is LoggedOut (guard handles this; component shows locked surface)", () => {
    beforeEach(async () => {
      await createComponent(AuthenticationStatus.LoggedOut);
    });

    it("renders the email-approval surface (guard has not redirected to login yet in unit test)", async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(pamApiService.getLeaseRequest).toHaveBeenCalledWith(REQUEST_ID);
    });
  });

  describe("when API call fails", () => {
    beforeEach(async () => {
      await createComponent(AuthenticationStatus.Locked, false);
    });

    it("shows the error state", async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const error = fixture.debugElement.query(By.css('[data-testid="leasing-request-error"]'));
      expect(error).not.toBeNull();
    });

    it("shows an error toast", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });
});
