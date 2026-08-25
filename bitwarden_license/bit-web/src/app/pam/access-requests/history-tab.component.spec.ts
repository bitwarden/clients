import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter, RouterLink } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { HistoryTabComponent } from "./history-tab.component";
import { MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

// Overrides are loosely typed rather than `Partial<MyAccessRequestRow>`: the row's `id` is an opaque
// branded type, so tests stand in plain strings and rely on the single cast below — the same
// convention as `my-access.service.spec.ts`.
function historyRow(overrides: Record<string, unknown> = {}): MyAccessRequestRow {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    cipherName: "Prod database",
    collectionName: "Production",
    status: "denied",
    badgeState: null,
    statusBadge: { labelKey: "pamStatusDenied", variant: "danger" },
    submittedAt: "2026-08-17T11:00:00.000Z",
    resolvedAt: "2026-08-17T11:30:00.000Z",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    resolverLabelKey: null,
    resolverName: "Ada",
    approverComment: null,
    producedLeaseId: null,
    extendedBySeconds: null,
    extendedUntil: null,
    ...overrides,
  } as unknown as MyAccessRequestRow;
}

describe("HistoryTabComponent", () => {
  let fixture: ComponentFixture<HistoryTabComponent>;
  let component: HistoryTabComponent;
  let myRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let managedRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let managedIds$: BehaviorSubject<Set<string>>;
  let inbox: {
    historyRows$: BehaviorSubject<MyAccessRequestRow[]>;
    managedIds$: BehaviorSubject<Set<string>>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    revokeLease: jest.Mock;
    cancelApproval: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

  function create(): void {
    fixture = TestBed.createComponent(HistoryTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  /** Switch to the approver-side scope and re-render. */
  function showManaged(): void {
    component["scope"].set("managed");
    fixture.detectChanges();
  }

  beforeEach(async () => {
    myRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    managedRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    managedIds$ = new BehaviorSubject<Set<string>>(new Set());
    inbox = {
      historyRows$: managedRows$,
      managedIds$,
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      revokeLease: jest.fn().mockResolvedValue(undefined),
      cancelApproval: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [HistoryTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: MyAccessService,
          useValue: {
            historyRows$: myRows$,
            cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
          },
        },
        { provide: ApproverInboxService, useValue: inbox },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    })
      .overrideComponent(HistoryTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  describe("scope toggle", () => {
    it("is hidden when there is no managed history to switch to", () => {
      myRows$.next([historyRow()]);

      create();

      expect(query('[data-testid="history-scope-managed"]')).toBeNull();
    });

    it("appears once the caller has managed history", () => {
      managedRows$.next([historyRow({ id: "managed-1" })]);

      create();

      expect(query('[data-testid="history-scope-managed"]')).not.toBeNull();
    });

    it("shows the caller's own rows by default", () => {
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1" })]);

      create();

      expect(component["historyRows"]().map((r) => r.id)).toEqual(["mine-1"]);
    });

    it("shows the managed rows once switched", () => {
      myRows$.next([historyRow({ id: "mine-1" })]);
      managedRows$.next([historyRow({ id: "managed-1" })]);
      create();

      showManaged();

      expect(component["historyRows"]().map((r) => r.id)).toEqual(["managed-1"]);
    });

    it("falls back to the caller's own rows if the managed side empties out", () => {
      managedRows$.next([historyRow({ id: "managed-1" })]);
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();
      showManaged();

      managedRows$.next([]);
      fixture.detectChanges();

      expect(component["showingManaged"]()).toBe(false);
      expect(component["historyRows"]().map((r) => r.id)).toEqual(["mine-1"]);
    });
  });

  describe("actions", () => {
    const activeGrant = historyRow({
      id: "managed-1",
      status: "approved",
      statusBadge: { labelKey: "pamStatusActivated", variant: "success" },
      producedLeaseId: "lease-1",
    });
    const unstartedApproval = historyRow({
      id: "managed-2",
      status: "approved",
      badgeState: null,
      statusBadge: { labelKey: "pamStatusApproved", variant: "success" },
      producedLeaseId: null,
    });

    beforeEach(() => {
      managedIds$.next(new Set(["managed-1", "managed-2"]));
    });

    it("offers no actions on the caller's own rows", () => {
      myRows$.next([activeGrant]);
      create();

      expect(component["canRevoke"](activeGrant)).toBe(false);
      expect(component["canCancelApproval"](unstartedApproval)).toBe(false);
    });

    it("offers Revoke for a live lease the caller granted", () => {
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      expect(component["canRevoke"](activeGrant)).toBe(true);
      expect(query('[data-testid="history-revoke-managed-1"]')).not.toBeNull();
    });

    it("offers no Revoke once the lease has already ended", () => {
      const revoked = historyRow({
        id: "managed-1",
        status: "approved",
        statusBadge: { labelKey: "pamStatusRevoked", variant: "subtle" },
        producedLeaseId: "lease-1",
      });
      managedRows$.next([revoked]);
      create();
      showManaged();

      expect(component["canRevoke"](revoked)).toBe(false);
    });

    it("offers Cancel for an approval the requester has not started", () => {
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      expect(component["canCancelApproval"](unstartedApproval)).toBe(true);
      expect(query('[data-testid="history-cancel-approval-managed-2"]')).not.toBeNull();
    });

    it("offers no action for a row the caller does not manage", () => {
      managedIds$.next(new Set());
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      expect(component["canRevoke"](activeGrant)).toBe(false);
    });

    it("confirms before revoking, since this cuts off access already in use", async () => {
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      await component["revoke"](activeGrant);

      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(inbox.revokeLease).toHaveBeenCalledWith("managed-1", "lease-1");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxRevokedToast",
      });
    });

    it("does not revoke when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      await component["revoke"](activeGrant);

      expect(inbox.revokeLease).not.toHaveBeenCalled();
    });

    it("toasts an error when the revoke fails", async () => {
      inbox.revokeLease.mockRejectedValue(new Error("boom"));
      managedRows$.next([activeGrant]);
      create();
      showManaged();

      await component["revoke"](activeGrant);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxRevokeFailed",
      });
    });

    it("cancels an approval without a confirm — nothing is in use yet", async () => {
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      await component["cancelApproval"](unstartedApproval);

      expect(inbox.cancelApproval).toHaveBeenCalledWith("managed-2");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxApprovalCanceledToast",
      });
    });

    it("toasts an error when cancelling an approval fails", async () => {
      inbox.cancelApproval.mockRejectedValue(new Error("boom"));
      managedRows$.next([unstartedApproval]);
      create();
      showManaged();

      await component["cancelApproval"](unstartedApproval);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxCancelApprovalFailed",
      });
    });
  });

  it("says which side is empty", () => {
    managedRows$.next([historyRow({ id: "managed-1" })]);
    create();
    expect(fixture.nativeElement.textContent).not.toContain("pamInboxHistoryEmpty");

    managedRows$.next([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("pamMyRequestsHistoryEmpty");
  });

  function drawerLinks(): RouterLink[] {
    return fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((el) => el.injector.get(RouterLink))
      .filter((link) => link.queryParams?.requestId != null);
  }

  it("opens a request with replaceUrl, so Back leaves the page instead of unwinding opened requests", () => {
    myRows$.next([historyRow()]);
    create();

    const links = drawerLinks();

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.replaceUrl)).toBe(true);
  });
});
