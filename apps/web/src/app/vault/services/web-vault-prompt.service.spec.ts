import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { VaultItemsTransferService } from "@bitwarden/vault";

import {
  AutoConfirmPolicyDialogComponent,
  PolicyEditDialogResult,
} from "../../admin-console/organizations/policies";
import { UnifiedUpgradePromptService } from "../../billing/individual/upgrade/services";
import { WebWelcomeExtensionPromptDialogComponent } from "../components/web-welcome-extension-prompt/web-welcome-extension-prompt-dialog.component";

import { WebBrowserInteractionService } from "./web-browser-interaction.service";
import { WebVaultPromptService } from "./web-vault-prompt.service";

describe("WebVaultPromptService", () => {
  let service: WebVaultPromptService;

  const mockUserId = "user-123" as UserId;
  const mockOrganizationId = "org-456";

  const getFeatureFlag$ = jest.fn().mockReturnValue(of(false));
  const open = jest.fn();
  const policies$ = jest.fn().mockReturnValue(of([]));
  const configurationAutoConfirm$ = jest
    .fn()
    .mockReturnValue(
      of({ showSetupDialog: false, enabled: false, showBrowserNotification: false }),
    );
  const upsertAutoConfirm = jest.fn().mockResolvedValue(undefined);
  const organizations$ = jest.fn().mockReturnValue(of([]));
  const displayUpgradePromptConditionally = jest.fn().mockResolvedValue(undefined);
  const enforceOrganizationDataOwnership = jest.fn().mockResolvedValue(undefined);
  const logError = jest.fn();
  const extensionInstalled$ = new BehaviorSubject<boolean>(false);
  const mockStateSubject = new BehaviorSubject<boolean>(false);
  const mockAccountCreationDate = new Date("2026-01-15"); // 25 days ago from test date
  const activeAccountSubject = new BehaviorSubject<{ id: UserId; creationDate: Date | null }>({
    id: mockUserId,
    creationDate: mockAccountCreationDate,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStateSubject.next(false);
    extensionInstalled$.next(false);
    activeAccountSubject.next({ id: mockUserId, creationDate: mockAccountCreationDate });

    TestBed.configureTestingModule({
      providers: [
        WebVaultPromptService,
        { provide: UnifiedUpgradePromptService, useValue: { displayUpgradePromptConditionally } },
        { provide: VaultItemsTransferService, useValue: { enforceOrganizationDataOwnership } },
        { provide: PolicyService, useValue: { policies$ } },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: activeAccountSubject.asObservable(),
          },
        },
        {
          provide: AutomaticUserConfirmationService,
          useValue: { configuration$: configurationAutoConfirm$, upsert: upsertAutoConfirm },
        },
        { provide: OrganizationService, useValue: { organizations$ } },
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        { provide: DialogService, useValue: { open } },
        { provide: LogService, useValue: { error: logError } },
        {
          provide: StateProvider,
          useValue: {
            getUser: jest.fn().mockReturnValue({
              state$: mockStateSubject.asObservable(),
            }),
          },
        },
        {
          provide: WebBrowserInteractionService,
          useValue: {
            extensionInstalled$: extensionInstalled$.asObservable(),
          },
        },
      ],
    });

    service = TestBed.inject(WebVaultPromptService);
  });

  describe("conditionallyPromptUser", () => {
    it("calls displayUpgradePromptConditionally", async () => {
      await service.conditionallyPromptUser();

      expect(
        service["unifiedUpgradePromptService"].displayUpgradePromptConditionally,
      ).toHaveBeenCalled();
    });

    it("calls enforceOrganizationDataOwnership with the userId", async () => {
      await service.conditionallyPromptUser();

      expect(
        service["vaultItemTransferService"].enforceOrganizationDataOwnership,
      ).toHaveBeenCalledWith(mockUserId);
    });

    it("opens welcome extension dialog when conditions are met", async () => {
      // Extension not installed
      extensionInstalled$.next(false);
      // Dialog not dismissed
      mockStateSubject.next(false);

      const openSpy = jest.spyOn(WebWelcomeExtensionPromptDialogComponent, "open");

      await service.conditionallyPromptUser();

      expect(openSpy).toHaveBeenCalledWith(expect.anything());
    });

    it("does not open welcome extension dialog when extension is installed", async () => {
      // Extension installed
      extensionInstalled$.next(true);
      // Dialog not dismissed
      mockStateSubject.next(false);

      const openSpy = jest.spyOn(WebWelcomeExtensionPromptDialogComponent, "open");

      await service.conditionallyPromptUser();

      expect(openSpy).not.toHaveBeenCalled();
    });

    it("does not open welcome extension dialog when already dismissed", async () => {
      // Extension not installed
      extensionInstalled$.next(false);
      // Dialog dismissed
      mockStateSubject.next(true);

      const openSpy = jest.spyOn(WebWelcomeExtensionPromptDialogComponent, "open");

      await service.conditionallyPromptUser();

      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  describe("setupAutoConfirm", () => {
    it("shows dialog when all conditions are met", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
        canManagePolicies: true,
        canEnableAutoConfirmPolicy: true,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const dialogClosedSubject = new BehaviorSubject<PolicyEditDialogResult>(null);
      const dialogRefMock = {
        closed: dialogClosedSubject.asObservable(),
      } as unknown as DialogRef<PolicyEditDialogResult>;

      const openSpy = jest
        .spyOn(AutoConfirmPolicyDialogComponent, "open")
        .mockReturnValue(dialogRefMock);

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).toHaveBeenCalledWith(expect.anything(), {
        data: {
          policy: expect.any(Object),
          organizationId: mockOrganizationId,
          firstTimeDialog: true,
        },
      });

      dialogClosedSubject.next(null);
    }));

    it("does not show dialog when feature flag is disabled", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(false));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when policy is already enabled", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );

      const mockPolicy = {
        type: PolicyType.AutoConfirm,
        enabled: true,
      } as Policy;
      policies$.mockReturnValueOnce(of([mockPolicy]));

      const mockOrg = {
        id: mockOrganizationId,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when showSetupDialog is false", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: false, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
      } as Organization;
      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when organization is undefined", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));
      organizations$.mockReturnValueOnce(of([]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("does not show dialog when organization cannot enable auto-confirm policy", fakeAsync(() => {
      getFeatureFlag$.mockReturnValueOnce(of(true));
      configurationAutoConfirm$.mockReturnValueOnce(
        of({ showSetupDialog: true, enabled: false, showBrowserNotification: false }),
      );
      policies$.mockReturnValueOnce(of([]));

      const mockOrg = {
        id: mockOrganizationId,
        canManagePolicies: false,
      } as Organization;

      organizations$.mockReturnValueOnce(of([mockOrg]));

      const openSpy = jest.spyOn(AutoConfirmPolicyDialogComponent, "open");

      void service.conditionallyPromptUser();

      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));
  });

  describe("showWelcomeExtensionDialog", () => {
    it("returns true when all conditions are met", async () => {
      extensionInstalled$.next(false);
      mockStateSubject.next(false);

      const result = await service["showWelcomeExtensionDialog"](mockUserId);

      expect(result).toBe(true);
    });

    it("returns false when extension is installed", async () => {
      extensionInstalled$.next(true);
      mockStateSubject.next(false);

      const result = await service["showWelcomeExtensionDialog"](mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when dialog has been dismissed", async () => {
      extensionInstalled$.next(false);
      mockStateSubject.next(true);

      const result = await service["showWelcomeExtensionDialog"](mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when account is older than 30 days", async () => {
      extensionInstalled$.next(false);
      mockStateSubject.next(false);
      const oldAccountDate = new Date("2025-12-01");
      activeAccountSubject.next({ id: mockUserId, creationDate: oldAccountDate });

      const result = await service["showWelcomeExtensionDialog"](mockUserId);

      expect(result).toBe(false);
    });
  });

  describe("profileIsOlderThan30Days", () => {
    it("returns false when account is less than 30 days old", async () => {
      const recentDate = new Date("2026-01-15"); // 25 days ago
      activeAccountSubject.next({ id: mockUserId, creationDate: recentDate });

      const result = await service["profileIsOlderThan30Days"]();

      expect(result).toBe(false);
    });

    it("returns false when account is exactly 30 days old", async () => {
      // The implementation uses < (less than), so exactly 30 days returns false
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      activeAccountSubject.next({ id: mockUserId, creationDate: thirtyDaysAgo });

      const result = await service["profileIsOlderThan30Days"]();

      expect(result).toBe(false);
    });

    it("returns true when account is older than 30 days", async () => {
      const oldDate = new Date("2025-12-01"); // More than 30 days ago
      activeAccountSubject.next({ id: mockUserId, creationDate: oldDate });

      const result = await service["profileIsOlderThan30Days"]();

      expect(result).toBe(true);
    });
  });
});
