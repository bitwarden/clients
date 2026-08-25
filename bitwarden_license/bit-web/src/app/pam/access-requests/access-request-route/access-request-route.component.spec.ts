import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DIALOG_DATA,
  DialogModule,
  DialogService,
  DrawerRef,
  ToastService,
} from "@bitwarden/components";

import type { AccessRequestView } from "../../abstractions/access-lease";
import { AccessRefreshService } from "../../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../../abstractions/access-request-sdk.service";
import { AccessRequestCancelService } from "../../services/access-request-cancel.service";
import { DefaultAccessRefreshService } from "../../services/default-access-refresh.service";
import { automaticDecision, humanDecision, selfEndDecision } from "../../testing/decision-builders";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-name-resolver.service";

import { AccessRequestDetailService } from "./access-request-detail.service";
import { AccessRequestRouteComponent } from "./access-request-route.component";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
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
    reload: jest.Mock;
    activate: jest.Mock;
    endLease: jest.Mock;
    setRequest: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let drawerRef: { isDrawer: true; close: jest.Mock };

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
      }),
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      reload: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue(undefined),
      endLease: jest.fn().mockResolvedValue(undefined),
      setRequest: jest.fn(),
    };
    drawerRef = { isDrawer: true, close: jest.fn() };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);
    requestsApi = mock<AccessRequestSdkService>();
    // The shared cancel flow re-reads the request rather than trusting what was rendered, so the
    // read tracks whatever the drawer is currently showing.
    requestsApi.getAccessRequest.mockImplementation(async () => detail.request$.value!);
    const logService = mock<LogService>();
    const i18nService = {
      t: (key: string, ...args: unknown[]) => [key, ...args].join(" "),
    } as I18nService;
    // No push in these tests: the flow is exercised through local mutations only.
    const accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    });

    await TestBed.configureTestingModule({
      imports: [AccessRequestRouteComponent, NoopAnimationsModule],
      providers: [
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: DIALOG_DATA, useValue: { requestId: "req-1" } },
        { provide: DrawerRef, useValue: drawerRef },
        { provide: I18nService, useValue: i18nService },
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessRefreshService, useValue: accessRefresh },
        // The real shared cancel flow over the same mocks, so the drawer's withdraw behaviour —
        // confirmation included — is exercised end to end rather than stubbed past.
        {
          provide: AccessRequestCancelService,
          useValue: new AccessRequestCancelService(
            requestsApi,
            accessRefresh,
            dialogService,
            toastService,
            i18nService,
            logService,
          ),
        },
      ],
    })
      // The detail service and the name resolver are provided ON the component, so they have to be
      // swapped there. `DialogModule` goes too: it provides `DialogService`, which would shadow the
      // mock this test asserts the end-lease confirm against.
      .overrideComponent(AccessRequestRouteComponent, {
        remove: {
          imports: [DialogModule],
          providers: [AccessRequestDetailService, AccessNameResolverService],
        },
        add: {
          schemas: [NO_ERRORS_SCHEMA],
          providers: [{ provide: AccessRequestDetailService, useValue: detail }],
        },
      })
      .compileComponents();
  });

  describe("loading states", () => {
    it("points the detail service at the request the drawer was opened for", () => {
      create();

      expect(detail.setRequest).toHaveBeenCalledWith("req-1");
    });

    it("renders the not-found state when the request is not available", () => {
      detail.request$.next(null);
      detail.notFound$.next(true);

      create();

      expect(text()).toContain("pamAccessRequestNotFound");
    });

    it("closes the drawer from the not-found state rather than linking nowhere", () => {
      detail.request$.next(null);
      detail.notFound$.next(true);
      create();

      component["close"]();

      expect(drawerRef.close).toHaveBeenCalled();
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

    it("names the withdraw action and renders it as the destructive one", () => {
      create();

      const button = fixture.nativeElement.querySelector(
        "#access-request_button_cancel",
      ) as HTMLElement;
      expect(button).not.toBeNull();
      expect(button.textContent?.trim()).toBe("pendingStateCancelRequest");
      expect(button.getAttribute("buttonType")).toBe("danger");
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

  describe("layout", () => {
    function labels(): (string | undefined)[] {
      return Array.from(fixture.nativeElement.querySelectorAll("dt")).map((label) =>
        (label as Element).textContent?.trim(),
      );
    }

    it("renders the gated item as its own row rather than as a value in the detail list", () => {
      create();

      expect(labels()).not.toContain("pamColumnItem");
      expect(fixture.nativeElement.querySelector("bit-item bit-item-content")).not.toBeNull();
    });

    it("leaves no icon in a value cell, so the value column shares one left edge", () => {
      create();

      const list = fixture.nativeElement.querySelector("dl") as HTMLElement;
      expect(list).not.toBeNull();
      expect(list.querySelector("dd bit-icon, dd app-vault-icon")).toBeNull();
    });

    it("shows the exact requested window as text rather than only on hover", () => {
      create();

      expect(text()).toContain(component["exactWindowText"]());
      expect(fixture.nativeElement.querySelector("[bitTooltip]")).toBeNull();
    });

    it("states the request's status once, outside the detail list", () => {
      detail.request$.next(request({ status: "denied", resolvedAt: PAST }));

      create();

      expect(labels()).not.toContain("pamColumnStatus");
    });

    it("keeps the live countdown in the detail list rather than in a section of its own", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "active" }),
      );

      create();

      expect(labels()).toContain("pamColumnRemaining");
    });

    it("drops the countdown row once the lease is no longer live", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "expired" }),
      );

      create();

      expect(labels()).not.toContain("pamColumnRemaining");
    });

    it("contains a decision's comment within its own log entry", () => {
      detail.request$.next(
        request({
          status: "denied",
          decisions: [
            humanDecision({
              id: "approver-1",
              name: "Ada",
              verdict: "deny",
              comment: "Use the read replica instead.",
            }),
          ],
        }),
      );

      create();

      const entry = fixture.nativeElement.querySelector(
        '[data-testid="access-request-decision"]',
      ) as HTMLElement;
      expect(entry).not.toBeNull();
      expect(entry.textContent).toContain("Ada");
      expect(entry.textContent).toContain("pamStatusDenied");
      expect(entry.textContent).toContain("Use the read replica instead.");
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
      expect(decisions[0].labelKey).toBe("pamStatusApproved");
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

    it("leads an entry with its verdict and demotes the actor to the supporting line", () => {
      detail.request$.next(
        request({
          status: "approved",
          decisions: [humanDecision({ id: "approver-1", name: "Ada" })],
        }),
      );

      create();

      const entry = fixture.nativeElement.querySelector(
        '[data-testid="access-request-decision"]',
      ) as HTMLElement;
      const lines = Array.from(entry.children) as HTMLElement[];
      const verdict = lines.findIndex((line) => line.textContent?.includes("pamStatusApproved"));
      const actor = lines.findIndex((line) => line.textContent?.includes("Ada"));

      expect(verdict).toBe(0);
      expect(actor).toBeGreaterThan(verdict);
      expect(lines[verdict].className).not.toContain("tw-text-muted");
      expect(lines[actor].className).toContain("tw-text-muted");
    });

    it("spends no badge on a log entry, leaving the header pill as the drawer's only status badge", () => {
      detail.request$.next(
        request({
          status: "approved",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "revoked",
          decisions: [automaticDecision(), selfEndDecision("user-1")],
        }),
      );

      create();

      const entries = fixture.nativeElement.querySelectorAll(
        '[data-testid="access-request-decision"]',
      ) as NodeListOf<HTMLElement>;

      expect(entries).toHaveLength(2);
      entries.forEach((entry) => expect(entry.querySelector("[bitBadge]")).toBeNull());
      expect(fixture.nativeElement.querySelectorAll("[bitBadge]")).toHaveLength(1);
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
    it("asks the shared confirmation before withdrawing, then cancels and reloads", async () => {
      create();

      await component["cancel"]();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "pamCancelRequestTitle" },
          content: { key: "pamCancelRequestPendingConfirm" },
          acceptButtonText: { key: "pendingStateCancelRequest" },
          cancelButtonText: { key: "pamKeepRequest" },
          type: "danger",
        }),
      );
      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("req-1");
      expect(detail.reload).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "success",
          message: "pamCancelRequestCanceledToast",
        }),
      );
    });

    it("describes an approved request's withdrawal in its own words", async () => {
      detail.request$.next(request({ status: "approved" }));
      create();

      await component["cancel"]();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "pamCancelRequestApprovedConfirm" } }),
      );
    });

    it("withdraws nothing when the confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      create();

      await component["cancel"]();

      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
      expect(detail.reload).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("toasts an error when cancelling fails", async () => {
      requestsApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));
      create();

      await component["cancel"]();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "pendingStateCancelError" }),
      );
      expect(detail.reload).not.toHaveBeenCalled();
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

      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
      expect(detail.activate).not.toHaveBeenCalled();
      expect(detail.endLease).not.toHaveBeenCalled();
    });
  });
});
