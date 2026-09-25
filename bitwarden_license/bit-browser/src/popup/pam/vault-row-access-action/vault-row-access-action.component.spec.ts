import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of, Subject } from "rxjs";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  type AccessRequestView,
  type CipherAccessStateView,
} from "@bitwarden/bit-common/pam";
import { ACTIVATE_ACCESS_SERVER_ERRORS } from "@bitwarden/bit-common/pam/helpers/activate-access-error";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { RequestAccessDialogComponent } from "../request-access-dialog/request-access-dialog.component";
import { VaultRowAccessStateService } from "../vault-row-access-state/vault-row-access-state.service";

import { VaultRowAccessActionComponent } from "./vault-row-access-action.component";

const ORGANIZATION_ID = "org-1";
const ACTIVE_BADGE = { active: { expiresAt: new Date(Date.now() + 18 * 60 * 1000).toISOString() } };
const ENDING_SOON_BADGE = {
  active: { expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString() },
};
const LAPSED_BADGE = { active: { expiresAt: new Date(Date.now() - 60 * 1000).toISOString() } };

function approvedRequest(overrides: Partial<AccessRequestView> = {}): AccessRequestView {
  return {
    id: "request-1",
    status: "approved",
    producedLeaseId: undefined,
    ...overrides,
  } as unknown as AccessRequestView;
}

function apiError(serverMessage: string): Error {
  return Object.assign(
    new Error(
      "error in response: status code 409 Conflict: " +
        JSON.stringify({ object: "error", message: serverMessage, validationErrors: null }),
    ),
    { name: "AccessRequestError", variant: "Api" },
  );
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: ORGANIZATION_ID,
    enabled: true,
    isProviderUser: false,
    ...overrides,
  });
}

describe("VaultRowAccessActionComponent", () => {
  let fixture: ComponentFixture<VaultRowAccessActionComponent>;
  let enabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<Organization[]>;
  let accessRowStateService: { state$: jest.Mock; invalidate: jest.Mock };
  let dialogService: { open: jest.Mock };
  let accessRequestSdkService: { activateAccessRequest: jest.Mock };
  let accessRefreshService: { notifyAccessChanged: jest.Mock };
  let toastService: { showToast: jest.Mock };

  function gatedCipher(overrides: Partial<CipherView> = {}): CipherView {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.name = "Prod database";
    cipher.partial = true;
    return Object.assign(cipher, overrides);
  }

  function stateOf(badgeState: unknown, fields: Partial<CipherAccessStateView> = {}) {
    accessRowStateService.state$.mockReturnValue(
      of({ badgeState, ...fields } as unknown as CipherAccessStateView),
    );
  }

  async function create(cipher: CipherView, render: "status" | "action" = "action"): Promise<void> {
    fixture = TestBed.createComponent(VaultRowAccessActionComponent);
    fixture.componentRef.setInput("cipher", cipher);
    fixture.componentRef.setInput("render", render);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<Organization[]>([
      organization({ usePam: true, accessPam: true }),
    ]);
    accessRowStateService = {
      state$: jest.fn().mockReturnValue(of({ badgeState: "privileged" })),
      invalidate: jest.fn(),
    };
    dialogService = { open: jest.fn() };
    accessRequestSdkService = { activateAccessRequest: jest.fn().mockResolvedValue({}) };
    accessRefreshService = { notifyAccessChanged: jest.fn() };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [VaultRowAccessActionComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: VaultRowAccessStateService, useValue: accessRowStateService },
        { provide: DialogService, useValue: dialogService },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        { provide: AccessRefreshService, useValue: accessRefreshService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: { error: jest.fn() } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("shows no button for a non-gated row", async () => {
    await create(gatedCipher({ partial: false }));

    expect(query("[data-testid='vault-row-access-action']")).toBeNull();
    expect(accessRowStateService.state$).not.toHaveBeenCalled();
  });

  it("shows no button when the PAM flag is off", async () => {
    enabled$.next(false);

    await create(gatedCipher());

    expect(query("[data-testid='vault-row-access-action']")).toBeNull();
  });

  it("shows the button for a requestable, licensed row", async () => {
    stateOf("privileged");

    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    expect(query("[data-testid='vault-row-access-action']")).not.toBeNull();
  });

  describe("per access phase, for a licensed member", () => {
    const slotTestIds = [
      "vault-row-access-action",
      "vault-row-access-start",
      "vault-row-access-badge",
    ];

    function onlyInSlot(testId: string | null): void {
      for (const id of slotTestIds) {
        if (id === testId) {
          expect(query(`[data-testid='${id}']`)).not.toBeNull();
        } else {
          expect(query(`[data-testid='${id}']`)).toBeNull();
        }
      }
    }

    it("privileged: shows only the Request chip", async () => {
      stateOf("privileged");

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

      onlyInSlot("vault-row-access-action");
      expect(
        query("[data-testid='vault-row-access-action']")?.getAttribute("aria-label"),
      ).toContain("pamRequestAccessButton");
    });

    it("pending: shows only the pending pill", async () => {
      stateOf("pending", { pendingRequest: approvedRequest({ status: "pending" } as never) });

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");

      onlyInSlot("vault-row-access-badge");
      expect(query("[data-testid='access-state-badge-pending']")).not.toBeNull();
    });

    it("ready: shows only the Start chip, named in full for assistive tech", async () => {
      stateOf("ready", { approvedRequest: approvedRequest() });

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

      onlyInSlot("vault-row-access-start");
      const start = query("[data-testid='vault-row-access-start']");
      expect(start?.getAttribute("aria-label")).toContain("pamStartLeaseButton");
      expect(start?.textContent).toContain("pamStartLeaseShort");
    });

    it("ready without an unstarted approved request: shows the ready pill, not Start", async () => {
      stateOf("ready", {
        approvedRequest: approvedRequest({ producedLeaseId: "lease-1" } as never),
      });

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");

      onlyInSlot("vault-row-access-badge");
      expect(query("[data-testid='access-state-badge-ready']")).not.toBeNull();
    });

    it("active: shows only the countdown pill", async () => {
      stateOf(ACTIVE_BADGE);

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");

      onlyInSlot("vault-row-access-badge");
      expect(query("[data-testid='access-state-badge-active']")).not.toBeNull();
    });

    it("active, revealed under the lease: keeps the countdown pill", async () => {
      stateOf(ACTIVE_BADGE);

      await create(
        gatedCipher({ organizationId: ORGANIZATION_ID, partial: false, leaseGated: true }),
        "status",
      );

      expect(query("[data-testid='access-state-badge-active']")).not.toBeNull();
    });

    it("status: renders the pill but never an action chip", async () => {
      stateOf("privileged");
      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");
      expect(query("[data-testid='vault-row-access-action']")).toBeNull();

      stateOf(ACTIVE_BADGE);
      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");
      expect(query("[data-testid='access-state-badge-active']")).not.toBeNull();
    });

    it("status slot: shows the compact countdown, named in full for assistive tech", async () => {
      stateOf(ACTIVE_BADGE);

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");

      const badge = query("[data-testid='access-state-badge-active']")!;
      expect(badge.textContent!.trim()).toBe("18m");
      expect(badge.getAttribute("aria-label")).toBe("pamAccessBadgeTimeLeft 18m");
      expect(badge.getAttribute("title")).toBe("pamAccessBadgeTimeLeft 18m");
    });

    it("action slot: renders nothing for a status-only phase", async () => {
      stateOf(ACTIVE_BADGE);

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

      expect(query("[data-testid='access-state-badge-active']")).toBeNull();
      expect(query("[data-testid='vault-row-access-action']")).toBeNull();
    });

    it("renders nothing for an ordinary, ungoverned cipher", async () => {
      stateOf(ACTIVE_BADGE);

      await create(gatedCipher({ organizationId: ORGANIZATION_ID, partial: false }));

      expect(accessRowStateService.state$).not.toHaveBeenCalled();
    });

    it("active, ending soon: shows only the escalated countdown pill", async () => {
      stateOf(ENDING_SOON_BADGE);

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");

      onlyInSlot("vault-row-access-badge");
      expect(query("[data-testid='access-state-badge-ending-soon']")).not.toBeNull();
    });

    it("active but lapsed before the next read: shows only the ended pill", async () => {
      stateOf(LAPSED_BADGE);

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }), "status");

      onlyInSlot("vault-row-access-badge");
      expect(query("[data-testid='access-state-badge-expired']")).not.toBeNull();
    });

    it("state unreadable: shows nothing", async () => {
      accessRowStateService.state$.mockReturnValue(of(null));

      await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

      onlyInSlot(null);
    });
  });

  it.each([
    ["privileged", {}],
    ["pending", {}],
    ["ready", { approvedRequest: approvedRequest() }],
    [ACTIVE_BADGE, {}],
  ])("shows nothing for an unlicensed member in badge state %p", async (badgeState, fields) => {
    organizations$.next([organization({ usePam: true, accessPam: false })]);
    stateOf(badgeState, fields);

    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    expect(fixture.nativeElement.children.length).toBe(0);
  });

  it("shows nothing for a ready row while licensing has not resolved", async () => {
    stateOf("ready", { approvedRequest: approvedRequest() });
    TestBed.overrideProvider(OrganizationService, {
      useValue: { organizations$: () => new Subject<Organization[]>() },
    });

    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    expect(fixture.nativeElement.children.length).toBe(0);
  });

  it("shows no pending pill for an unlicensed member", async () => {
    organizations$.next([organization({ usePam: true, accessPam: false })]);
    stateOf("pending");

    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    expect(query("[data-testid='vault-row-access-badge']")).toBeNull();
  });

  it("shows no button for an unlicensed member", async () => {
    organizations$.next([organization({ usePam: true, accessPam: false })]);
    stateOf("privileged");

    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    expect(query("[data-testid='vault-row-access-action']")).toBeNull();
  });

  it("shows no button while licensing has not resolved", async () => {
    stateOf("privileged");
    TestBed.overrideProvider(OrganizationService, {
      useValue: { organizations$: () => new Subject<Organization[]>() },
    });

    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    expect(query("[data-testid='vault-row-access-action']")).toBeNull();
  });

  it("opens the dialog for the row's cipher and stops the click from bubbling", async () => {
    stateOf("privileged");
    dialogService.open.mockReturnValue({ closed: of(undefined) });
    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    const button = query("[data-testid='vault-row-access-action']") as HTMLButtonElement;
    const rowClick = jest.fn();
    fixture.nativeElement.addEventListener("click", rowClick);
    button.click();
    await fixture.whenStable();

    expect(dialogService.open).toHaveBeenCalledWith(RequestAccessDialogComponent, {
      data: { cipherId: "cipher-1", itemName: "Prod database" },
    });
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("invalidates the row's cached state once the dialog submits a request", async () => {
    stateOf("privileged");
    dialogService.open.mockReturnValue({ closed: of("submitted") });
    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    (query("[data-testid='vault-row-access-action']") as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(accessRowStateService.invalidate).toHaveBeenCalledWith("cipher-1");
  });

  it("invalidates the row's cached state when the dialog reconciles an existing grant", async () => {
    stateOf("privileged");
    dialogService.open.mockReturnValue({ closed: of("reconciled") });
    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    (query("[data-testid='vault-row-access-action']") as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(accessRowStateService.invalidate).toHaveBeenCalledWith("cipher-1");
  });

  it("does not invalidate anything when the dialog is dismissed", async () => {
    stateOf("privileged");
    dialogService.open.mockReturnValue({ closed: of(undefined) });
    await create(gatedCipher({ organizationId: ORGANIZATION_ID }));

    (query("[data-testid='vault-row-access-action']") as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(accessRowStateService.invalidate).not.toHaveBeenCalled();
  });

  describe("Start", () => {
    let toasts: jest.Mock;

    async function clickStart(): Promise<jest.Mock> {
      stateOf("ready", { approvedRequest: approvedRequest({ id: "request-7" } as never) });
      await create(gatedCipher({ organizationId: ORGANIZATION_ID }));
      const rowClick = jest.fn();
      fixture.nativeElement.addEventListener("click", rowClick);
      (query("[data-testid='vault-row-access-start']") as HTMLButtonElement).click();
      await fixture.whenStable();
      return rowClick;
    }

    beforeEach(() => {
      toasts = toastService.showToast;
    });

    it("activates the unstarted approved request and stops the click from bubbling", async () => {
      const rowClick = await clickStart();

      expect(accessRequestSdkService.activateAccessRequest).toHaveBeenCalledWith("request-7");
      expect(rowClick).not.toHaveBeenCalled();
    });

    it("toasts success, invalidates the row and announces the change on success", async () => {
      await clickStart();

      expect(toasts).toHaveBeenCalledWith({ variant: "success", message: "pamStartLeaseSuccess" });
      expect(accessRowStateService.invalidate).toHaveBeenCalledWith("cipher-1");
      expect(accessRefreshService.notifyAccessChanged).toHaveBeenCalledWith("cipher-1");
    });

    it.each(Object.entries(ACTIVATE_ACCESS_SERVER_ERRORS))(
      "toasts the %s refusal's copy and re-reads the row",
      async (_name, { serverMessage, messageKey }) => {
        accessRequestSdkService.activateAccessRequest.mockRejectedValue(apiError(serverMessage));

        await clickStart();

        expect(toasts).toHaveBeenCalledWith({ variant: "error", message: messageKey });
        expect(accessRowStateService.invalidate).toHaveBeenCalledWith("cipher-1");
        expect(accessRefreshService.notifyAccessChanged).not.toHaveBeenCalled();
      },
    );

    it("toasts the licensing refusal's copy", async () => {
      accessRequestSdkService.activateAccessRequest.mockRejectedValue(
        apiError(ACTIVATE_ACCESS_SERVER_ERRORS.Unlicensed.serverMessage),
      );

      await clickStart();

      expect(toasts).toHaveBeenCalledWith({ variant: "error", message: "pamLeaseErrorUnlicensed" });
    });

    it("toasts generic copy for an unrecognised failure", async () => {
      accessRequestSdkService.activateAccessRequest.mockRejectedValue(new Error("boom"));

      await clickStart();

      expect(toasts).toHaveBeenCalledWith({ variant: "error", message: "pamStartLeaseError" });
      expect(accessRowStateService.invalidate).toHaveBeenCalledWith("cipher-1");
    });

    it("disables the chip while activation is in flight", async () => {
      let resolve!: () => void;
      accessRequestSdkService.activateAccessRequest.mockReturnValue(
        new Promise<void>((r) => (resolve = r)),
      );
      stateOf("ready", { approvedRequest: approvedRequest() });
      await create(gatedCipher({ organizationId: ORGANIZATION_ID }));
      const start = query("[data-testid='vault-row-access-start']") as HTMLButtonElement;

      start.click();
      fixture.detectChanges();

      expect(start.getAttribute("aria-disabled")).toBe("true");
      start.click();
      expect(accessRequestSdkService.activateAccessRequest).toHaveBeenCalledTimes(1);

      resolve();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(start.getAttribute("aria-disabled")).not.toBe("true");
    });
  });
});
