import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import type { AccessLeaseId, AccessRequestView } from "../abstractions/access-lease";
import { ApprovalRow, toApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { ManagedLeaseRow, toManagedLeaseRow } from "../approvals/managed-lease-row";

import { emptyResolvedNames } from "./access-name-resolver.service";
import { ApprovalsTabComponent } from "./approvals-tab.component";

const NOW = new Date("2026-08-17T12:00:00.000Z");

const NAMES = {
  ...emptyResolvedNames(),
  cipherNameById: new Map([["cipher-1", "Prod database"]]),
  collectionNameById: new Map([["col-1", "Production"]]),
};

function accessRequest(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    reason: "prod incident",
    submittedAt: "2026-08-17T11:30:00.000Z",
    decisions: [],
    requesterName: "Grace",
    requesterEmail: "grace@example.com",
    ...overrides,
  } as unknown as AccessRequestView;
}

function row(overrides: Record<string, unknown> = {}, canDecide = true): ApprovalRow {
  return toApprovalRow(accessRequest(overrides), NAMES, NOW, canDecide);
}

function leaseRow(
  overrides: Record<string, unknown> = {},
  extension?: { addedSeconds: number; latestEndMs: number },
): ManagedLeaseRow {
  return toManagedLeaseRow(
    accessRequest({
      status: "approved",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "active",
      ...overrides,
    }) as AccessRequestView & { producedLeaseId: AccessLeaseId },
    NAMES,
    extension,
  );
}

describe("ApprovalsTabComponent", () => {
  let fixture: ComponentFixture<ApprovalsTabComponent>;
  let component: ApprovalsTabComponent;
  let inbox: {
    inboxRows$: BehaviorSubject<ApprovalRow[]>;
    activeLeaseRows$: BehaviorSubject<ManagedLeaseRow[]>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    loading$: BehaviorSubject<boolean>;
    decide: jest.Mock;
    revokeLease: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

  function create(): void {
    fixture = TestBed.createComponent(ApprovalsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  beforeEach(async () => {
    inbox = {
      inboxRows$: new BehaviorSubject<ApprovalRow[]>([]),
      activeLeaseRows$: new BehaviorSubject<ManagedLeaseRow[]>([]),
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      loading$: new BehaviorSubject<boolean>(false),
      decide: jest.fn().mockResolvedValue(undefined),
      revokeLease: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [ApprovalsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApproverInboxService, useValue: inbox },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          // Echoes the key (plus any params) rather than a lookup table: the component library asks
          // for keys of its own, and I18nMockService throws on any key it was not given.
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: unknown[]) =>
              [key, ...args.filter((a) => a != null)].join(" "),
          },
        },
      ],
    })
      // Stubs the vault favicon component, which pulls in environment/settings services this test
      // has no interest in.
      .overrideComponent(ApprovalsTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  describe("rendering", () => {
    it("shows the loading message while loading and nothing has arrived yet", () => {
      inbox.loading$.next(true);

      create();

      expect(query('[bitTypography="body2"]')?.textContent).toContain("loading");
      expect(query('[data-testid="approvals-empty"]')).toBeNull();
    });

    it("shows the empty state when there is nothing to approve", () => {
      create();

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
    });

    it("renders a row per pending request", () => {
      inbox.inboxRows$.next([row({ id: "req-1" }), row({ id: "req-2" })]);

      create();

      expect(query('[data-testid="approvals-row-req-1"]')).not.toBeNull();
      expect(query('[data-testid="approvals-row-req-2"]')).not.toBeNull();
    });

    it("shows the item, requester, window and reason", () => {
      inbox.inboxRows$.next([row()]);

      create();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("Prod database");
      expect(text).toContain("Grace");
      expect(text).toContain("pamInboxDuration1Hour");
      expect(text).toContain("prod incident");
    });

    it("says so explicitly when a request carries no reason", () => {
      inbox.inboxRows$.next([row({ reason: undefined })]);

      create();

      expect(fixture.nativeElement.textContent).toContain("pamInboxReasonMissing");
    });

    it("disables both decisions on the caller's own request", () => {
      inbox.inboxRows$.next([row({ id: "mine" }, false)]);

      create();

      // `bitButton` marks aria-disabled and removes the native attribute, so the button stays
      // focusable for screen readers — which is also why the component guards `decide()` itself.
      expect(query('[data-testid="approvals-approve-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
      expect(query('[data-testid="approvals-deny-mine"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
    });

    it("keeps the filter toolbar on screen when a filter matches nothing", () => {
      // Otherwise there is no way to clear the filter that emptied the table.
      inbox.inboxRows$.next([row()]);
      create();

      component["searchControl"].setValue("nothing matches this");
      fixture.detectChanges();

      expect(query('[data-testid="approvals-no-results"]')).not.toBeNull();
      expect(query("bit-search")).not.toBeNull();
    });

    it("filters by search term across item, collection and requester", () => {
      inbox.inboxRows$.next([
        row({ id: "keep" }),
        row({ id: "drop", requesterName: "Someone", requesterEmail: undefined }),
      ]);
      create();

      component["searchControl"].setValue("grace");
      fixture.detectChanges();

      expect(component["rows"]().map((r) => r.id)).toEqual(["keep"]);
    });
  });

  describe("deciding", () => {
    beforeEach(() => {
      inbox.inboxRows$.next([row({ id: "req-1" })]);
    });

    it("records an approval once confirmed, and toasts", async () => {
      dialogService.open.mockReturnValue({
        closed: of({ confirmed: true, comment: "fine" }),
      } as never);
      create();

      await component["decide"](component["rows"]()[0], "approve");

      expect(inbox.decide).toHaveBeenCalledWith("req-1", "approve", "fine");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("does nothing when the dialog is dismissed", async () => {
      // Cancel, the header X, Escape and a backdrop click all close with undefined.
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      create();

      await component["decide"](component["rows"]()[0], "approve");

      expect(inbox.decide).not.toHaveBeenCalled();
    });

    it("toasts an error when recording the decision fails", async () => {
      dialogService.open.mockReturnValue({
        closed: of({ confirmed: true, comment: undefined }),
      } as never);
      inbox.decide.mockRejectedValue(new Error("boom"));
      create();

      await component["decide"](component["rows"]()[0], "deny");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxDecisionFailed",
      });
    });

    it("never opens the dialog for the caller's own request", async () => {
      inbox.inboxRows$.next([row({ id: "mine" }, false)]);
      create();

      await component["decide"](component["rows"]()[0], "approve");

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(inbox.decide).not.toHaveBeenCalled();
    });
  });

  describe("currently checked out", () => {
    it("renders a row per live lease, with the holder and the item on it", () => {
      inbox.activeLeaseRows$.next([
        leaseRow({ producedLeaseId: "lease-1" }),
        leaseRow(
          { id: "req-2", producedLeaseId: "lease-2", requesterName: "Alan" },
          {
            addedSeconds: 3600,
            latestEndMs: Date.parse("2026-08-17T14:00:00.000Z"),
          },
        ),
      ]);

      create();

      expect(query('[data-testid="approvals-lease-lease-1"]')).not.toBeNull();
      expect(query('[data-testid="approvals-lease-lease-2"]')).not.toBeNull();
      expect(query('[data-testid="approvals-lease-extended-lease-2"]')).not.toBeNull();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("Prod database");
      expect(text).toContain("Grace");
      expect(text).toContain("Alan");
    });

    it("shows both sections when there is live access but nothing pending", () => {
      inbox.activeLeaseRows$.next([leaseRow()]);

      create();

      expect(query('[data-testid="approvals-empty"]')).toBeNull();
      expect(query("bit-accordion-group")).not.toBeNull();
      expect(query('[data-testid="approvals-pending-empty"]')).not.toBeNull();
      expect(query('[data-testid="approvals-lease-lease-1"]')).not.toBeNull();
    });

    it("shows the inbox-zero empty state only when both sections are empty", () => {
      create();

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
      expect(query("bit-accordion-group")).toBeNull();
    });

    it("revokes the lease once confirmed, and toasts", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      inbox.activeLeaseRows$.next([leaseRow()]);
      create();

      await component["revoke"](component["leaseRows"]()[0]);

      expect(inbox.revokeLease).toHaveBeenCalledWith("req-1", "lease-1");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("does nothing when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      inbox.activeLeaseRows$.next([leaseRow()]);
      create();

      await component["revoke"](component["leaseRows"]()[0]);

      expect(inbox.revokeLease).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("toasts an error when the revoke fails", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      inbox.revokeLease.mockRejectedValue(new Error("boom"));
      inbox.activeLeaseRows$.next([leaseRow()]);
      create();

      await component["revoke"](component["leaseRows"]()[0]);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxRevokeFailed",
      });
    });
  });
});
