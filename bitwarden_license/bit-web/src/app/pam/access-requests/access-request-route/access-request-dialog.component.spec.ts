import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import type { AccessRequestView } from "../../abstractions/access-lease";
import { ApprovalRow } from "../../approvals/approval-row";
import { DecideDialogComponent } from "../../approvals/decide-dialog/decide-dialog.component";
import { automaticDecision, humanDecision } from "../../testing/decision-builders";
import { ResolvedNames, emptyResolvedNames } from "../access-name-resolver.service";
import { lapsedGrantBadge } from "../my-access-row";

import { AccessRequestDetailService, AccessRequestViewer } from "./access-request-detail.service";
import {
  AccessRequestDialogComponent,
  AccessRequestDialogParams,
} from "./access-request-dialog.component";

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

describe("AccessRequestDialogComponent", () => {
  let fixture: ComponentFixture<AccessRequestDialogComponent>;
  let component: AccessRequestDialogComponent;
  let detail: {
    request$: BehaviorSubject<AccessRequestView | null>;
    loading$: BehaviorSubject<boolean>;
    notFound$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    names$: BehaviorSubject<ResolvedNames>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    viewer$: BehaviorSubject<AccessRequestViewer | null>;
    approvalRow$: BehaviorSubject<ApprovalRow | null>;
    managed$: BehaviorSubject<boolean>;
    cancel: jest.Mock;
    activate: jest.Mock;
    endLease: jest.Mock;
    decide: jest.Mock;
    withdrawApproval: jest.Mock;
    revokeLease: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

  function create(): void {
    fixture = TestBed.createComponent(AccessRequestDialogComponent);
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
      viewer$: new BehaviorSubject<AccessRequestViewer | null>("requester"),
      approvalRow$: new BehaviorSubject<ApprovalRow | null>(null),
      managed$: new BehaviorSubject<boolean>(false),
      cancel: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue(undefined),
      endLease: jest.fn().mockResolvedValue(undefined),
      decide: jest.fn().mockResolvedValue(undefined),
      withdrawApproval: jest.fn().mockResolvedValue(undefined),
      revokeLease: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    // The detail service is route-scoped, handed in by the host route via `DIALOG_DATA`.
    const params = {
      detail: detail as unknown as AccessRequestDetailService,
    } satisfies AccessRequestDialogParams;

    await TestBed.configureTestingModule({
      imports: [AccessRequestDialogComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close: jest.fn() } },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    })
      // `DialogModule` provides the real `DialogService` in the component's own injector,
      // shadowing a module-level override.
      .overrideComponent(AccessRequestDialogComponent, {
        add: { providers: [{ provide: DialogService, useValue: dialogService }] },
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

    it("badges the item in its own card and keeps Submitted among the details", () => {
      detail.request$.next(request({ status: "denied", resolvedAt: new Date().toISOString() }));

      create();

      const item = fixture.nativeElement.querySelector(
        '[data-testid="request-summary-item"]',
      ) as HTMLElement;
      const details = fixture.nativeElement.querySelector(
        '[data-testid="request-summary-details"]',
      ) as HTMLElement;
      // Status reads with the item's name, not as a row among the request's fields.
      expect(item.textContent).toContain("pamStatusDenied");
      expect(details.textContent).not.toContain("pamColumnStatus");
      expect(details.textContent).toContain("pamColumnSubmitted");
    });

    it("moves Resolved out of the details and into the decision card", () => {
      detail.request$.next(request({ status: "denied", resolvedAt: new Date().toISOString() }));

      create();

      const details = fixture.nativeElement.querySelector(
        '[data-testid="request-summary-details"]',
      ) as HTMLElement;
      const decision = fixture.nativeElement.querySelector(
        '[data-testid="request-detail-decision"]',
      ) as HTMLElement;
      expect(details.textContent).not.toContain("pamColumnResolved");
      expect(decision.textContent).toContain("pamColumnResolved");
    });

    it("renders each shared row exactly once, not alongside the page's old list", () => {
      create();

      const rendered = fixture.nativeElement.textContent as string;
      expect(rendered.split("pamInboxRequester").length - 1).toBe(1);
      expect(
        fixture.nativeElement.querySelectorAll("#pam-request-summary_value_reason"),
      ).toHaveLength(1);
      expect(
        fixture.nativeElement.querySelectorAll("#pam-request-summary_value_access-requested"),
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

  describe("the decision card", () => {
    /** The card the dialog renders under "Decision"; absent until something has been decided. */
    function decisionCard(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="request-detail-decision"]');
    }

    it("credits the system when an access rule decided on its own", () => {
      detail.request$.next(request({ status: "approved", decisions: [automaticDecision()] }));

      create();

      expect(decisionCard()!.textContent).toContain("pamDecisionAutomatic");
    });

    it("credits a human approver by name, and names the decision as an approval", () => {
      detail.request$.next(
        request({
          status: "approved",
          decisions: [humanDecision({ id: "approver-1", name: "Ada", verdict: "approve" })],
        }),
      );

      create();

      expect(decisionCard()!.textContent).toContain("pamDecisionApprovedBy");
      expect(decisionCard()!.textContent).toContain("Ada");
    });

    it("falls back to the approver's email, and never to their raw id", () => {
      detail.request$.next(
        request({
          status: "approved",
          decisions: [humanDecision({ id: "approver-1", email: "ada@acme.com" })],
        }),
      );

      create();

      expect(decisionCard()!.textContent).toContain("ada@acme.com");
      expect(decisionCard()!.textContent).not.toContain("approver-1");
    });

    it("names a denial as one, and shows the note the approver left", () => {
      detail.request$.next(
        request({
          status: "denied",
          resolvedAt: new Date().toISOString(),
          decisions: [
            humanDecision({
              id: "approver-1",
              name: "Ada",
              email: "ada@acme.com",
              verdict: "deny",
              comment: "Out of scope",
            }),
          ],
        }),
      );

      create();

      expect(decisionCard()!.textContent).toContain("pamDecisionDeniedBy");
      expect(decisionCard()!.textContent).toContain("pamDecisionComment");
      expect(decisionCard()!.textContent).toContain("Out of scope");
    });

    it("stays away until there is an outcome to name", () => {
      detail.request$.next(request({ status: "pending", decisions: [] }));

      create();

      expect(decisionCard()).toBeNull();
    });

    it("names only when the request resolved without a recorded decision", () => {
      detail.request$.next(request({ status: "expired", resolvedAt: new Date().toISOString() }));

      create();

      expect(decisionCard()!.textContent).toContain("pamColumnResolved");
      expect(decisionCard()!.textContent).not.toContain("pamDecisionApprovedBy");
    });
  });

  describe("status and remaining time", () => {
    /** The badge the item card carries; a running lease shows a countdown instead of a label. */
    function badgeOf(): { badgeState: unknown; statusBadge: unknown } | null {
      return component["badge"]() ?? null;
    }

    it("badges the item once, even after the request produced access", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "revoked" }),
      );

      create();

      const item = fixture.nativeElement.querySelector(
        '[data-testid="request-summary-item"]',
      ) as HTMLElement;
      expect(item.querySelectorAll("[bitBadge], app-pam-access-state-badge")).toHaveLength(1);
    });

    it("counts the lease down in the badge while access is running", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "active" }),
      );

      create();

      expect(badgeOf()?.badgeState).toEqual({ kind: "active", expiresAt: expect.any(Date) });
    });

    it("stops counting down once access has ended", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "revoked" }),
      );

      create();

      expect(badgeOf()?.badgeState).toBeNull();
    });

    it("badges an unactivated grant Ready to use while its activation window is open", () => {
      detail.request$.next(request({ status: "approved", leaseNotAfter: FUTURE }));

      create();

      expect(component["badge"]()).toEqual({
        badgeState: { kind: "ready" },
        statusBadge: null,
      });
    });

    it("reads an unactivated grant whose window already lapsed as expired", () => {
      detail.request$.next(request({ status: "approved", leaseNotAfter: PAST }));

      create();

      expect(component["badge"]()).toEqual({ badgeState: null, statusBadge: lapsedGrantBadge });
    });

    it("flips an unactivated grant to expired when its window lapses while the dialog is open", () => {
      const notAfter = new Date(Date.now() + 2000).toISOString();
      detail.request$.next(request({ status: "approved", leaseNotAfter: notAfter }));

      create();
      expect(component["badge"]()?.badgeState).toEqual({ kind: "ready" });

      component["nowMs"].set(Date.parse(notAfter) + 1000);

      expect(component["badge"]()).toEqual({ badgeState: null, statusBadge: lapsedGrantBadge });
    });

    it("leaves an activated grant alone past the request's window, where the lease's own end governs", () => {
      detail.request$.next(
        request({
          status: "approved",
          leaseNotAfter: PAST,
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
        }),
      );

      create();

      expect(component["badge"]()).toEqual({
        badgeState: null,
        statusBadge: { labelKey: "pamStatusActivated", variant: "success" },
      });
    });
  });

  describe("the produced lease", () => {
    const activeLease = {
      status: "approved",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "active",
    };

    /** The instant the badge counts down to, or null when it is not counting. */
    function countdownTarget(): number | null {
      const state = component["badge"]()?.badgeState;
      return state != null && state.kind === "active" ? state.expiresAt.getTime() : null;
    }

    function extendedBadge(): string | null {
      return (
        fixture.nativeElement.querySelector('[data-testid="request-detail-lease-extended"]')
          ?.textContent ?? null
      );
    }

    it("counts down the lease's own end, not the request's activation window", () => {
      detail.request$.next(
        request({
          ...activeLease,
          leaseNotAfter: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
          producedLeaseNotAfter: new Date(Date.now() + 37 * 60 * 1000).toISOString(),
        }),
      );

      create();

      expect(countdownTarget()).toBe(Date.parse(component["request"]()!.producedLeaseNotAfter!));
    });

    it("falls back to the activation window when the server sends no lease end", () => {
      detail.request$.next(
        request({
          ...activeLease,
          leaseNotAfter: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
        }),
      );

      create();

      expect(countdownTarget()).toBe(Date.parse(component["request"]()!.leaseNotAfter));
    });

    it("withholds the countdown once the lease's own end has passed", () => {
      detail.request$.next(
        request({ ...activeLease, leaseNotAfter: FUTURE, producedLeaseNotAfter: PAST }),
      );

      create();

      expect(countdownTarget()).toBeNull();
    });

    it("badges the time an extension added, and the end it moved the lease to", () => {
      detail.request$.next(
        request({
          ...activeLease,
          leaseNotAfter: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
          producedLeaseNotAfter: new Date(Date.now() + 37 * 60 * 1000).toISOString(),
        }),
      );

      create();

      expect(extendedBadge()).toContain("pamExtendedBadge 30m");
    });

    it("badges no extension when the lease still ends where the request said", () => {
      detail.request$.next(request({ ...activeLease, producedLeaseNotAfter: FUTURE }));

      create();

      expect(extendedBadge()).toBeNull();
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

    it("offers Cancel only while the request is still undecided", () => {
      detail.request$.next(request({ status: "pending", leaseNotAfter: PAST }));
      create();
      expect(component["canCancel"]()).toBe(true);

      // Once approved the dialog offers Start instead; the table still withdraws it.
      detail.request$.next(request({ status: "approved" }));
      expect(component["canCancel"]()).toBe(false);

      detail.request$.next(request({ status: "denied" }));
      expect(component["canCancel"]()).toBe(false);
    });

    it("offers Submit new request once the request was refused or timed out", () => {
      detail.request$.next(request({ status: "denied", resolvedAt: PAST }));
      create();
      expect(component["canResubmit"]()).toBe(true);

      detail.request$.next(request({ status: "expired", resolvedAt: PAST }));
      expect(component["canResubmit"]()).toBe(true);

      detail.request$.next(request({ status: "pending" }));
      expect(component["canResubmit"]()).toBe(false);

      detail.request$.next(request({ status: "approved" }));
      expect(component["canResubmit"]()).toBe(false);
    });

    it("points Submit new request at the item, where a fresh request is raised", () => {
      detail.request$.next(request({ status: "denied", resolvedAt: PAST }));

      create();

      const link = fixture.nativeElement.querySelector(
        '[data-testid="request-detail-resubmit"]',
      ) as HTMLAnchorElement;
      expect(link.getAttribute("href")).toContain("/vault");
      expect(link.getAttribute("href")).toContain("itemId=cipher-1");
    });

    it("never offers an approver the requester's resubmit", () => {
      detail.viewer$.next("approver");
      detail.request$.next(request({ status: "denied", resolvedAt: PAST }));

      create();

      expect(component["canResubmit"]()).toBe(false);
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

    it("leaves an approved request with Start beside Close, and nothing else", () => {
      detail.request$.next(request({ status: "approved" }));

      create();

      const footer = fixture.nativeElement.querySelector("footer") as HTMLElement;
      expect(footer.querySelector("#access-request-dialog_button_start")).not.toBeNull();
      expect(footer.querySelector("#access-request-dialog_button_close")).not.toBeNull();
      // Withdrawing an approval is the table's job, so the dialog does not double as one.
      expect(footer.querySelector("#access-request-dialog_button_cancel-request")).toBeNull();
    });

    it("leaves a pending request with Cancel beside Close", () => {
      detail.request$.next(request({ status: "pending" }));

      create();

      const footer = fixture.nativeElement.querySelector("footer") as HTMLElement;
      expect(footer.querySelector("#access-request-dialog_button_cancel-request")).not.toBeNull();
      expect(footer.querySelector("#access-request-dialog_button_start")).toBeNull();
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

    it("maps the server's reason to a client-side i18n key without leaking the raw payload", async () => {
      detail.request$.next(request({ status: "approved" }));
      detail.activate.mockRejectedValue(
        Object.assign(
          new Error(
            'error in response: status code 400 Bad Request: {"object":"error",' +
              '"message":"The approved access window has already ended.",' +
              '"validationErrors":null,"exceptionStackTrace":"   at Bit.Services.Pam' +
              '.OrganizationFeatures.Commands.ActivateAccessRequestCommand.ActivateAsync"}',
          ),
          { name: "AccessRequestError", variant: "Api" },
        ),
      );
      create();

      await component["startAccess"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseErrorWindowEnded",
      });
      const shown = toastService.showToast.mock.calls[0][0].message as string;
      expect(shown).not.toContain("exceptionStackTrace");
      expect(shown).not.toContain("Bit.Services.Pam");
    });

    it("falls back to the generic message when starting access fails for another reason", async () => {
      detail.request$.next(request({ status: "approved" }));
      detail.activate.mockRejectedValue(new Error("offline"));
      create();

      await component["startAccess"]();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamStartLeaseError",
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
  describe("viewed by an approver", () => {
    /** Someone else's request, as it sits in the viewer's approvals inbox. */
    function inboxRow(): ApprovalRow {
      return { id: "req-1", request: request(), cipherId: "cipher-1" } as unknown as ApprovalRow;
    }

    function footerButton(id: string): HTMLElement | null {
      return (fixture.nativeElement.querySelector("footer") as HTMLElement).querySelector(
        `#access-request-dialog_button_${id}`,
      );
    }

    beforeEach(() => {
      detail.viewer$.next("approver");
    });

    it("offers Approve and Deny on a pending request in their inbox, never the requester's Cancel", () => {
      detail.approvalRow$.next(inboxRow());

      create();

      expect(footerButton("approve")).not.toBeNull();
      expect(footerButton("deny")).not.toBeNull();
      expect(footerButton("cancel-request")).toBeNull();
    });

    /**
     * The footer's shape is the design's safeguard: the decision a mis-click would be costly for
     * is held away from the one beside Close.
     */
    describe("the footer's shape", () => {
      it("separates Deny from Approve so the two cannot be reached for interchangeably", () => {
        detail.approvalRow$.next(inboxRow());

        create();

        const deny = footerButton("deny")!;
        const approve = footerButton("approve")!;
        expect(deny.className).toContain("tw-ms-auto");
        expect(approve.className).not.toContain("tw-ms-auto");
        // Approve leads; Deny trails everything, Close included.
        const order = [...(fixture.nativeElement.querySelector("footer") as HTMLElement).children];
        expect(order.indexOf(approve)).toBeLessThan(order.indexOf(deny));
        expect(order.indexOf(footerButton("close")!)).toBeLessThan(order.indexOf(deny));
      });

      it("styles Deny as destructive, and Approve as the primary action", () => {
        detail.approvalRow$.next(inboxRow());

        create();

        expect(footerButton("deny")!.getAttribute("buttonType")).toBe("danger");
        expect(footerButton("approve")!.getAttribute("buttonType")).toBe("primary");
      });

      it("promotes Withdraw approval to the primary action on an unstarted grant", () => {
        detail.managed$.next(true);
        detail.request$.next(request({ status: "approved", leaseNotAfter: FUTURE }));

        create();

        expect(footerButton("withdraw-approval")!.getAttribute("buttonType")).toBe("primary");
      });

      it("styles ending a running session as destructive", () => {
        detail.managed$.next(true);
        detail.request$.next(
          request({
            status: "approved",
            producedLeaseId: "lease-1",
            producedLeaseStatus: "active",
          }),
        );

        create();

        expect(footerButton("revoke")!.getAttribute("buttonType")).toBe("danger");
      });

      it("leaves a denied request with nothing to do but close", () => {
        detail.request$.next(request({ status: "denied", resolvedAt: new Date().toISOString() }));

        create();

        const footer = fixture.nativeElement.querySelector("footer") as HTMLElement;
        expect(footer.querySelectorAll("button")).toHaveLength(1);
        expect(footerButton("close")).not.toBeNull();
      });
    });

    it("offers no decision when the request is not in their inbox", () => {
      create();

      expect(footerButton("approve")).toBeNull();
      expect(footerButton("cancel-request")).toBeNull();
    });

    it("offers none of the requester's actions on an approved or active request", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "active" }),
      );
      create();
      expect(component["canStart"]()).toBe(false);
      expect(component["canEndLease"]()).toBe(false);

      detail.request$.next(request({ status: "approved" }));
      expect(component["canStart"]()).toBe(false);
      expect(component["canCancel"]()).toBe(false);
    });

    it("hides the requester's actions until it is known who is viewing", () => {
      detail.viewer$.next(null);

      create();

      expect(footerButton("cancel-request")).toBeNull();
      expect(footerButton("approve")).toBeNull();
    });

    it("records the verdict the decide dialog closed with, and toasts", async () => {
      detail.approvalRow$.next(inboxRow());
      dialogService.open.mockReturnValue({
        closed: of({ confirmed: true, verdict: "deny", comment: "Not tonight" }),
      } as any);
      create();

      await component["decide"]("approve");

      expect(dialogService.open).toHaveBeenCalledWith(
        DecideDialogComponent,
        expect.objectContaining({ data: expect.objectContaining({ verdict: "approve" }) }),
      );
      expect(detail.decide).toHaveBeenCalledWith("deny", "Not tonight");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxDeniedToast",
      });
    });

    it("records nothing when the decide dialog is dismissed", async () => {
      detail.approvalRow$.next(inboxRow());
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);
      create();

      await component["decide"]("approve");

      expect(detail.decide).not.toHaveBeenCalled();
    });

    it("toasts an error when the decision fails", async () => {
      detail.approvalRow$.next(inboxRow());
      detail.decide.mockRejectedValue(new Error("boom"));
      dialogService.open.mockReturnValue({
        closed: of({ confirmed: true, verdict: "approve", comment: undefined }),
      } as any);
      create();

      await component["decide"]("approve");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxDecisionFailed",
      });
    });

    /**
     * The server refuses a managing approver's withdrawal without a note, so the dialog turns to
     * its own confirmation face and holds the action until one is written.
     */
    describe("withdrawing an approval", () => {
      function openConfirm(): void {
        detail.request$.next(request({ status: "approved" }));
        detail.managed$.next(true);
        create();
        component["withdrawApproval"]();
        fixture.detectChanges();
      }

      it("confirms in place rather than opening a second dialog", () => {
        openConfirm();

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(component["confirmingWithdraw"]()).toBe(true);
        expect(
          fixture.nativeElement.querySelector('[data-testid="withdraw-confirm-reason"]'),
        ).not.toBeNull();
      });

      it("keeps the item on screen so the destructive action has its context", () => {
        openConfirm();

        expect(
          fixture.nativeElement.querySelector('[data-testid="withdraw-confirm-summary"]'),
        ).not.toBeNull();
        expect(
          fixture.nativeElement.querySelector('[data-testid="withdraw-confirm-warning"]'),
        ).not.toBeNull();
      });

      it("holds the withdrawal until a reason is written", () => {
        // `bitButton` marks a held action with `aria-disabled` so keyboard users still reach it.
        const held = () => footerButton("confirm-withdraw")!.getAttribute("aria-disabled");

        openConfirm();
        expect(held()).toBe("true");

        component["withdrawReason"].setValue("   ");
        fixture.detectChanges();
        expect(held()).toBe("true");

        component["withdrawReason"].setValue("Scope changed");
        fixture.detectChanges();
        expect(held()).toBeNull();
      });

      it("sends the reason the requester will read", async () => {
        openConfirm();
        component["withdrawReason"].setValue("  Scope changed  ");

        await component["confirmWithdraw"]();

        expect(detail.withdrawApproval).toHaveBeenCalledWith("Scope changed");
        expect(component["confirmingWithdraw"]()).toBe(false);
      });

      it("returns to the request on Cancel, withdrawing nothing", () => {
        openConfirm();
        component["withdrawReason"].setValue("Scope changed");

        component["cancelWithdraw"]();
        fixture.detectChanges();

        expect(detail.withdrawApproval).not.toHaveBeenCalled();
        expect(component["confirmingWithdraw"]()).toBe(false);
        expect(footerButton("withdraw-approval")).not.toBeNull();
      });
    });

    it("offers Revoke on a live lease they manage, even past the requested window", async () => {
      detail.request$.next(
        request({
          status: "approved",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
          leaseNotAfter: PAST,
        }),
      );
      detail.managed$.next(true);
      create();

      expect(footerButton("revoke")).not.toBeNull();
      await component["revoke"]();

      expect(detail.revokeLease).toHaveBeenCalledWith("lease-1");
    });

    it("offers neither Withdraw nor Revoke on a collection they don't manage", () => {
      detail.request$.next(
        request({ status: "approved", producedLeaseId: "lease-1", producedLeaseStatus: "active" }),
      );
      create();

      expect(component["canRevoke"]()).toBe(false);
      detail.request$.next(request({ status: "approved" }));
      expect(component["canWithdrawApproval"]()).toBe(false);
    });
  });
});
