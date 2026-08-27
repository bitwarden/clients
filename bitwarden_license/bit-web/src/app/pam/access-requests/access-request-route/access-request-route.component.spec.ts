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
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import type { AccessRequestView } from "../../abstractions/access-lease";
import { automaticDecision, humanDecision, selfEndDecision } from "../../testing/decision-builders";
import { ResolvedNames, emptyResolvedNames } from "../access-name-resolver.service";

import { AccessRequestDetailService } from "./access-request-detail.service";
import { AccessRequestRouteComponent } from "./access-request-route.component";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: new Date().toISOString(),
    leaseNotAfter: FUTURE,
    submittedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    decisions: [],
    requesterName: "Grace",
    ...overrides,
  } as unknown as AccessRequestView;
}

describe("AccessRequestRouteComponent", () => {
  let fixture: ComponentFixture<AccessRequestRouteComponent>;
  let component: AccessRequestRouteComponent;
  let detail: {
    request$: BehaviorSubject<AccessRequestView | null>;
    loading$: BehaviorSubject<boolean>;
    notFound$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    names$: BehaviorSubject<ResolvedNames>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    cancel: jest.Mock;
    activate: jest.Mock;
    endLease: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

  function create(): void {
    fixture = TestBed.createComponent(AccessRequestRouteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  beforeEach(async () => {
    detail = {
      request$: new BehaviorSubject<AccessRequestView | null>(request()),
      loading$: new BehaviorSubject<boolean>(false),
      notFound$: new BehaviorSubject<boolean>(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
      names$: new BehaviorSubject<ResolvedNames>({
        ...emptyResolvedNames(),
        cipherNameById: new Map([["cipher-1", "Prod database"]]),
        collectionNameById: new Map([["col-1", "Production"]]),
        organizationNameById: new Map([["org-1", "Meridian Group"]]),
      }),
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      cancel: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue(undefined),
      endLease: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AccessRequestRouteComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    })
      // The detail service is provided ON the component, so it has to be swapped there; the header
      // module pulls in page chrome this test has no interest in.
      .overrideComponent(AccessRequestRouteComponent, {
        remove: { imports: [HeaderModule], providers: [AccessRequestDetailService] },
        add: {
          schemas: [NO_ERRORS_SCHEMA],
          providers: [{ provide: AccessRequestDetailService, useValue: detail }],
        },
      })
      .compileComponents();
  });

  describe("loading states", () => {
    it("renders the not-found state when the request is not available", () => {
      detail.request$.next(null);
      detail.notFound$.next(true);

      create();

      expect(text()).toContain("pamAccessRequestNotFound");
    });

    it("toasts a load failure that is not a not-found", () => {
      create();

      detail.loadError$.next(new Error("boom"));

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamAccessRequestLoadError",
      });
    });
  });

  describe("rendering", () => {
    it("shows the resolved item and collection names", () => {
      create();

      expect(component["cipherName"]()).toBe("Prod database");
      expect(component["collectionName"]()).toBe("Production");
    });

    it("falls back to the raw cipher id when the item is not in the caller's vault", () => {
      detail.names$.next(emptyResolvedNames());

      create();

      expect(component["cipherName"]()).toBe("cipher-1");
      expect(component["collectionName"]()).toBeNull();
    });

    it("resolves the owning organization's name, and nothing when it is unknown", () => {
      create();
      expect(component["organizationName"]()).toBe("Meridian Group");

      detail.names$.next(emptyResolvedNames());
      expect(component["organizationName"]()).toBeNull();
    });

    it("keeps Status, Submitted and Resolved beside the shared request-details rows", () => {
      detail.request$.next(request({ status: "denied", resolvedAt: new Date().toISOString() }));

      create();

      const details = fixture.nativeElement.querySelector(
        '[data-testid="request-summary-details"]',
      ) as HTMLElement;
      expect(details.textContent).toContain("pamColumnStatus");
      expect(details.textContent).toContain("pamColumnSubmitted");
      expect(details.textContent).toContain("pamColumnResolved");
    });

    it("renders each shared row exactly once, not alongside the page's old list", () => {
      create();

      const text = fixture.nativeElement.textContent as string;
      expect(text.split("pamInboxRequester").length - 1).toBe(1);
      expect(
        fixture.nativeElement.querySelectorAll("#pam-request-summary_input_reason"),
      ).toHaveLength(1);
      expect(
        fixture.nativeElement.querySelectorAll("#pam-request-summary_input_access-requested"),
      ).toHaveLength(1);
    });

    it("identifies the requester by name, then email, then id", () => {
      create();
      expect(component["requesterDisplay"]()).toBe("Grace");

      detail.request$.next(request({ requesterName: undefined, requesterEmail: "g@example.com" }));
      expect(component["requesterDisplay"]()).toBe("g@example.com");

      detail.request$.next(request({ requesterName: undefined, requesterEmail: undefined }));
      expect(component["requesterDisplay"]()).toBe("user-1");
    });
  });

  describe("the decision log", () => {
    it("credits the access rule for an automatic decision", () => {
      detail.request$.next(request({ status: "approved", decisions: [automaticDecision()] }));

      create();

      const decisions = component["decisions"]();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].automatic).toBe(true);
      expect(decisions[0].labelKey).toBe("pamStatusApproved");
    });

    it("credits a human approver by name", () => {
      detail.request$.next(
        request({
          status: "approved",
          decisions: [humanDecision({ id: "approver-1", name: "Ada" })],
        }),
      );

      create();

      const decisions = component["decisions"]();
      expect(decisions[0].automatic).toBe(false);
      expect(decisions[0].who).toBe("Ada");
    });

    it("falls back to the approver's email, then their id", () => {
      detail.request$.next(
        request({
          status: "approved",
          decisions: [
            humanDecision({ id: "approver-1", email: "ada@example.com" }),
            humanDecision({ id: "approver-2" }),
          ],
        }),
      );

      create();

      expect(component["decisions"]()[0].who).toBe("ada@example.com");
      expect(component["decisions"]()[1].who).toBe("approver-2");
    });

    it("reads a deny on a denied request as a denial", () => {
      detail.request$.next(
        request({
          status: "denied",
          decisions: [humanDecision({ id: "approver-1", name: "Ada", verdict: "deny" })],
        }),
      );

      create();

      expect(component["decisions"]()[0].labelKey).toBe("pamStatusDenied");
    });

    it("reads the holder's own deny as ending their lease, not a denial", () => {
      // The revoke path records its reason as a deny decision; only the decider tells them apart.
      detail.request$.next(
        request({
          status: "approved",
          decisions: [automaticDecision(), selfEndDecision("user-1")],
        }),
      );

      create();

      const decisions = component["decisions"]();
      expect(decisions[1].labelKey).toBe("pamAuditKindLeaseEndedByHolder");
      expect(text()).not.toContain("pamStatusDenied");
    });

    it("reads someone else's deny on an activated request as an operator revoke", () => {
      detail.request$.next(
        request({
          status: "approved",
          decisions: [
            automaticDecision(),
            humanDecision({ id: "operator-9", name: "Ops", verdict: "deny" }),
          ],
        }),
      );

      create();

      expect(component["decisions"]()[1].labelKey).toBe("pamAuditKindLeaseRevoked");
    });
  });

  describe("action gating", () => {
    it("offers Start only for an approved request still inside its window", () => {
      detail.request$.next(request({ status: "approved" }));
      create();
      expect(component["canStart"]()).toBe(true);

      detail.request$.next(request({ status: "approved", leaseNotAfter: PAST }));
      expect(component["canStart"]()).toBe(false);

      detail.request$.next(request({ status: "pending" }));
      expect(component["canStart"]()).toBe(false);
    });

    it("offers Cancel for a pending request, and for an approved one not yet lapsed", () => {
      detail.request$.next(request({ status: "pending", leaseNotAfter: PAST }));
      create();
      expect(component["canCancel"]()).toBe(true);

      detail.request$.next(request({ status: "approved" }));
      expect(component["canCancel"]()).toBe(true);

      detail.request$.next(request({ status: "approved", leaseNotAfter: PAST }));
      expect(component["canCancel"]()).toBe(false);

      detail.request$.next(request({ status: "denied" }));
      expect(component["canCancel"]()).toBe(false);
    });

    it("offers End only while the produced lease is live", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "active" }),
      );
      create();
      expect(component["canEndLease"]()).toBe(true);

      detail.request$.next(
        request({
          status: "approved",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "revoked",
        }),
      );
      expect(component["canEndLease"]()).toBe(false);
    });
  });

  describe("actions", () => {
    it("cancels and toasts", async () => {
      create();

      await component["cancel"]();

      expect(detail.cancel).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamMyRequestsCanceledToast",
      });
    });

    it("toasts an error when cancelling fails", async () => {
      detail.cancel.mockRejectedValue(new Error("boom"));
      create();

      await component["cancel"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamMyRequestsCancelError",
      });
    });

    it("starts access and toasts", async () => {
      detail.request$.next(request({ status: "approved" }));
      create();

      await component["startAccess"]();

      expect(detail.activate).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamStartLeaseSuccess",
      });
    });

    it("confirms before ending the lease", async () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "active" }),
      );
      create();

      await component["endLease"]();

      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(detail.endLease).toHaveBeenCalledWith("lease-1");
    });

    it("does not end the lease when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "active" }),
      );
      create();

      await component["endLease"]();

      expect(detail.endLease).not.toHaveBeenCalled();
    });

    it("does nothing when an action is not available", async () => {
      detail.request$.next(request({ status: "denied" }));
      create();

      await component["cancel"]();
      await component["startAccess"]();
      await component["endLease"]();

      expect(detail.cancel).not.toHaveBeenCalled();
      expect(detail.activate).not.toHaveBeenCalled();
      expect(detail.endLease).not.toHaveBeenCalled();
    });
  });
});
