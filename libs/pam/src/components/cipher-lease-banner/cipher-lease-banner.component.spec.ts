import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { CipherAccessState, PamApiService } from "../../abstractions/pam-api.service";
import {
  AccessApprovalMode,
  AccessPreCheckResponse,
} from "../../abstractions/responses/access-pre-check.response";
import { AccessRequestDetailsResponse } from "../../abstractions/responses/access-request-details.response";
import { AccessRequestResultResponse } from "../../abstractions/responses/access-request-result.response";

import { CipherLeaseBannerComponent } from "./cipher-lease-banner.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function preCheck(
  approvalMode: AccessApprovalMode,
  hasActiveLease = false,
): AccessPreCheckResponse {
  return new AccessPreCheckResponse({
    CipherId: "cipher-1",
    ApprovalMode: approvalMode,
    HasActiveLease: hasActiveLease,
  });
}

function automaticEnvelope() {
  return new AccessRequestResultResponse({
    Object: "accessRequest",
    ApprovalMode: "automatic",
    Request: {
      Object: "leaseRequest",
      Id: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      OrganizationId: "org-1",
      Status: "approved",
      NotBefore: "2026-06-04T12:00:00Z",
      NotAfter: "2026-06-04T13:00:00Z",
      Reason: null,
      CreationDate: "2026-06-04T12:00:00Z",
    },
  });
}

function humanEnvelope() {
  return new AccessRequestResultResponse({
    Object: "accessRequest",
    ApprovalMode: "human",
    Request: {
      Object: "leaseRequest",
      Id: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      OrganizationId: "org-1",
      Status: "pending",
      NotBefore: "2026-06-05T09:00:00Z",
      NotAfter: "2026-06-05T17:00:00Z",
      Reason: "incident",
      CreationDate: "2026-06-04T12:00:00Z",
    },
  });
}

describe("CipherLeaseBannerComponent", () => {
  let fixture: ComponentFixture<CipherLeaseBannerComponent>;
  let component: CipherLeaseBannerComponent;
  let pamApi: {
    getCipherAccessState$: jest.Mock;
    getAccessPreCheck: jest.Mock;
    submitAccessRequest: jest.Mock;
  };
  let toastService: jest.Mocked<Pick<ToastService, "showToast">>;

  const setup = (
    state: CipherAccessState = {},
    flagOn = true,
    getAccessPreCheck: () => Promise<AccessPreCheckResponse> = () =>
      Promise.resolve(preCheck("automatic")),
  ) => {
    pamApi = {
      getCipherAccessState$: jest.fn().mockReturnValue(of(state)),
      getAccessPreCheck: jest.fn(getAccessPreCheck),
      submitAccessRequest: jest.fn(),
    };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [CipherLeaseBannerComponent],
      providers: [
        { provide: PamApiService, useValue: pamApi },
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: { openSimpleDialog: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
        { provide: LogService, useValue: { error: jest.fn() } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" } as Account) } },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: jest.fn().mockReturnValue(of(flagOn)) },
        },
      ],
    });

    fixture = TestBed.createComponent(CipherLeaseBannerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("cipherId", "cipher-1");
    fixture.componentRef.setInput("partialData", '{"Name":"n"}');
    fixture.detectChanges();
  };

  // Open the fold-out and flush the pre-check fetch that shapes the form.
  const expandForm = async () => {
    await component["toggleRequestForm"]();
    fixture.detectChanges();
  };

  const submitButton = () =>
    fixture.debugElement.query(By.css("[data-testid='request-access-submit']"));

  afterEach(() => fixture?.destroy());

  describe("entry point", () => {
    it("shows the 'Request access' toggle for a gated cipher with no lease/request, form collapsed", () => {
      setup();

      expect(component["canRequestAccess"]()).toBe(true);
      const toggle = fixture.debugElement.query(
        By.css("#cipher-lease-banner_button_request-access-toggle"),
      );
      expect(toggle.nativeElement.textContent).toContain("pamRequestAccessButton");
      expect(submitButton()).toBeNull();
    });

    it("hides the entry point once a pending request exists", () => {
      setup({ pendingRequest: { id: "req-1" } as AccessRequestDetailsResponse });

      expect(component["canRequestAccess"]()).toBe(false);
    });

    it("folds the inline form out on toggle and collapses again", async () => {
      setup();

      await expandForm();
      expect(component["requestFormExpanded"]()).toBe(true);
      expect(submitButton()).toBeTruthy();

      await component["toggleRequestForm"]();
      fixture.detectChanges();
      expect(component["requestFormExpanded"]()).toBe(false);
      expect(submitButton()).toBeNull();
    });
  });

  describe("automatic outcome", () => {
    beforeEach(() => setup());

    it("renders the duration picker (no date/time inputs) when expanded", async () => {
      await expandForm();

      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-duration']")),
      ).toBeTruthy();
      expect(fixture.debugElement.query(By.css("[data-testid='request-access-date']"))).toBeNull();
    });

    it("submits with durationSeconds derived from durationMinutes and collapses on success", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockResolvedValue(automaticEnvelope());
      component["automaticForm"].patchValue({ durationMinutes: 240, reason: "  incident  " });

      await component["submitRequest"]();

      expect(pamApi.submitAccessRequest).toHaveBeenCalledWith(
        "cipher-1",
        expect.objectContaining({ durationSeconds: 240 * 60, reason: "incident" }),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(component["requestFormExpanded"]()).toBe(false);
    });

    it("omits reason when blank", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockResolvedValue(automaticEnvelope());

      await component["submitRequest"]();

      const body = pamApi.submitAccessRequest.mock.calls[0][1];
      expect(body.reason).toBeUndefined();
    });

    it("rejects a duration over the 24h cap", async () => {
      await expandForm();
      component["automaticForm"].patchValue({ durationMinutes: 24 * 60 + 1 });
      expect(component["automaticForm"].valid).toBe(false);
    });
  });

  describe("human outcome", () => {
    beforeEach(() => setup({}, true, () => Promise.resolve(preCheck("human"))));

    it("renders the window pickers (no duration select) when expanded", async () => {
      await expandForm();

      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-date']")),
      ).toBeTruthy();
      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-duration']")),
      ).toBeNull();
    });

    it("requires a non-blank reason", async () => {
      await expandForm();
      component["humanForm"].patchValue({
        customDate: "2026-06-05",
        customStart: "09:00",
        customEnd: "17:00",
        reason: "   ",
      });
      expect(component["humanForm"].valid).toBe(false);

      component["humanForm"].patchValue({ reason: "incident" });
      expect(component["humanForm"].valid).toBe(true);
    });

    it("flags end <= start", async () => {
      await expandForm();
      component["humanForm"].patchValue({
        customDate: "2026-06-05",
        customStart: "17:00",
        customEnd: "09:00",
        reason: "incident",
      });
      expect(component["customWindowEndBeforeStart"]).toBe(true);
    });

    it("submits with start/end ISO strings and trimmed reason and collapses on success", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockResolvedValue(humanEnvelope());
      component["humanForm"].patchValue({
        customDate: "2026-06-05",
        customStart: "09:00",
        customEnd: "17:00",
        reason: "  incident  ",
      });

      await component["submitRequest"]();

      const body = pamApi.submitAccessRequest.mock.calls[0][1];
      expect(body.start).toBeDefined();
      expect(body.end).toBeDefined();
      expect(body.reason).toBe("incident");
      expect(body.durationSeconds).toBeUndefined();
      expect(component["requestFormExpanded"]()).toBe(false);
    });
  });

  describe("fold-out shaping", () => {
    it("collapses without shaping when a lease already covers the cipher (raced)", async () => {
      setup({}, true, () => Promise.resolve(preCheck("automatic", true)));

      await expandForm();

      expect(component["requestFormExpanded"]()).toBe(false);
      expect(component["requestMode"]()).toBeNull();
    });

    it("surfaces a generic error and renders no form when the pre-check fails", async () => {
      setup({}, true, () => Promise.reject(new Error("offline")));

      await expandForm();

      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
      expect(submitButton()).toBeNull();
    });
  });

  describe("submit error handling", () => {
    beforeEach(() => setup());

    it("maps 'already active' 400 to an info toast + collapse (no inline error)", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have active access to this item." }, 400),
      );

      await component["submitRequest"]();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "info" }),
      );
      expect(component["requestFormExpanded"]()).toBe(false);
      expect(component["requestError"]()).toBeNull();
    });

    it("maps 'already approved' 400 to an info toast + collapse", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have an approved request for this item." }, 400),
      );

      await component["submitRequest"]();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "info" }),
      );
      expect(component["requestFormExpanded"]()).toBe(false);
    });

    it("maps 'already pending' 400 to a collapse", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have a pending request for this item." }, 400),
      );

      await component["submitRequest"]();

      expect(component["requestFormExpanded"]()).toBe(false);
    });

    it("surfaces a 'duration exceeds max' 400 inline without collapsing", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse(
          { Message: "The requested duration exceeds the maximum of 86400 seconds." },
          400,
        ),
      );

      await component["submitRequest"]();
      fixture.detectChanges();

      expect(component["requestFormExpanded"]()).toBe(true);
      expect(component["requestError"]()).toContain("86400");
    });

    it("falls back to a generic error for non-400 failures", async () => {
      await expandForm();
      pamApi.submitAccessRequest.mockRejectedValue(new Error("network"));

      await component["submitRequest"]();

      expect(component["requestFormExpanded"]()).toBe(true);
      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
    });
  });
});
