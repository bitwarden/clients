import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { lastValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "@bitwarden/web-vault/app/billing/individual/upgrade/unified-upgrade-dialog/unified-upgrade-dialog.component";

import { VaultItemDialogResult } from "../components/vault-item-dialog/vault-item-dialog.component";

import { WebVaultPremiumUpgradePromptService } from "./web-premium-upgrade-prompt.service";

describe("WebVaultPremiumUpgradePromptService", () => {
  let service: WebVaultPremiumUpgradePromptService;
  let dialogServiceMock: jest.Mocked<DialogService>;
  let routerMock: jest.Mocked<Router>;
  let dialogRefMock: jest.Mocked<DialogRef>;
  let configServiceMock: jest.Mocked<ConfigService>;
  let accountServiceMock: jest.Mocked<AccountService>;
  let apiServiceMock: jest.Mocked<ApiService>;
  let syncServiceMock: jest.Mocked<SyncService>;
  let billingAccountProfileServiceMock: jest.Mocked<BillingAccountProfileStateService>;
  let platformUtilsServiceMock: jest.Mocked<PlatformUtilsService>;

  beforeEach(() => {
    dialogServiceMock = {
      openSimpleDialog: jest.fn(),
    } as unknown as jest.Mocked<DialogService>;

    configServiceMock = {
      getFeatureFlag: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<ConfigService>;

    accountServiceMock = {
      activeAccount$: of({ id: "user-123" }),
    } as unknown as jest.Mocked<AccountService>;

    routerMock = {
      navigate: jest.fn(),
    } as unknown as jest.Mocked<Router>;

    dialogRefMock = {
      close: jest.fn(),
    } as unknown as jest.Mocked<DialogRef<VaultItemDialogResult>>;

    apiServiceMock = {
      refreshIdentityToken: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<ApiService>;

    syncServiceMock = {
      fullSync: jest.fn(),
    } as unknown as jest.Mocked<SyncService>;

    billingAccountProfileServiceMock = {
      hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)),
    } as unknown as jest.Mocked<BillingAccountProfileStateService>;

    platformUtilsServiceMock = {
      isSelfHost: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<PlatformUtilsService>;

    TestBed.configureTestingModule({
      providers: [
        WebVaultPremiumUpgradePromptService,
        { provide: DialogService, useValue: dialogServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: DialogRef, useValue: dialogRefMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: AccountService, useValue: accountServiceMock },
        { provide: ApiService, useValue: apiServiceMock },
        { provide: SyncService, useValue: syncServiceMock },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileServiceMock },
        { provide: PlatformUtilsService, useValue: platformUtilsServiceMock },
      ],
    });

    service = TestBed.inject(WebVaultPremiumUpgradePromptService);
  });

  it("prompts for premium upgrade and navigates to organization billing if organizationId is provided", async () => {
    dialogServiceMock.openSimpleDialog.mockReturnValue(lastValueFrom(of(true)));
    const organizationId = "test-org-id" as OrganizationId;

    await service.promptForPremium(organizationId);

    expect(dialogServiceMock.openSimpleDialog).toHaveBeenCalledWith({
      title: { key: "upgradeOrganization" },
      content: { key: "upgradeOrganizationDesc" },
      acceptButtonText: { key: "upgradeOrganization" },
      type: "info",
    });
    expect(routerMock.navigate).toHaveBeenCalledWith([
      "organizations",
      organizationId,
      "billing",
      "subscription",
    ]);
    expect(dialogRefMock.close).toHaveBeenCalledWith(VaultItemDialogResult.PremiumUpgrade);
  });

  it("prompts for premium upgrade and navigates to premium subscription if organizationId is not provided", async () => {
    dialogServiceMock.openSimpleDialog.mockReturnValue(lastValueFrom(of(true)));

    await service.promptForPremium();

    expect(dialogServiceMock.openSimpleDialog).toHaveBeenCalledWith({
      title: { key: "premiumRequired" },
      content: { key: "premiumRequiredDesc" },
      acceptButtonText: { key: "upgrade" },
      type: "success",
    });
    expect(routerMock.navigate).toHaveBeenCalledWith(["settings/subscription/premium"]);
    expect(dialogRefMock.close).toHaveBeenCalledWith(VaultItemDialogResult.PremiumUpgrade);
  });

  it("does not navigate or close dialog if upgrade is no action is taken", async () => {
    dialogServiceMock.openSimpleDialog.mockReturnValue(lastValueFrom(of(false)));

    await service.promptForPremium("test-org-id" as OrganizationId);

    expect(routerMock.navigate).not.toHaveBeenCalled();
    expect(dialogRefMock.close).not.toHaveBeenCalled();
  });

  describe("premium status check", () => {
    it("should not prompt if user already has premium (feature flag off)", async () => {
      configServiceMock.getFeatureFlag.mockReturnValue(Promise.resolve(false));
      billingAccountProfileServiceMock.hasPremiumFromAnySource$.mockReturnValue(of(true));

      await service.promptForPremium();

      expect(dialogServiceMock.openSimpleDialog).not.toHaveBeenCalled();
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it("should not prompt if user already has premium (feature flag on)", async () => {
      configServiceMock.getFeatureFlag.mockImplementation((flag: FeatureFlag) => {
        if (flag === FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      billingAccountProfileServiceMock.hasPremiumFromAnySource$.mockReturnValue(of(true));

      const unifiedDialogRefMock = {
        closed: of({ status: UnifiedUpgradeDialogStatus.Closed }),
        close: jest.fn(),
      } as any;
      jest.spyOn(UnifiedUpgradeDialogComponent, "open").mockReturnValue(unifiedDialogRefMock);

      await service.promptForPremium();

      expect(UnifiedUpgradeDialogComponent.open).not.toHaveBeenCalled();
      expect(dialogServiceMock.openSimpleDialog).not.toHaveBeenCalled();
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });

  describe("new premium upgrade dialog with post-upgrade actions", () => {
    beforeEach(() => {
      configServiceMock.getFeatureFlag.mockImplementation((flag: FeatureFlag) => {
        if (flag === FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
    });

    describe("when self-hosted", () => {
      beforeEach(() => {
        platformUtilsServiceMock.isSelfHost.mockReturnValue(true);
      });

      it("should navigate to subscription page instead of opening dialog", async () => {
        await service.promptForPremium();

        expect(routerMock.navigate).toHaveBeenCalledWith(["settings/subscription/premium"]);
        expect(dialogServiceMock.openSimpleDialog).not.toHaveBeenCalled();
      });
    });

    describe("when not self-hosted", () => {
      beforeEach(() => {
        platformUtilsServiceMock.isSelfHost.mockReturnValue(false);
      });

      it("should full sync when user upgrades to premium", async () => {
        const unifiedDialogRefMock = {
          closed: of({ status: UnifiedUpgradeDialogStatus.UpgradedToPremium }),
          close: jest.fn(),
        } as any;
        jest.spyOn(UnifiedUpgradeDialogComponent, "open").mockReturnValue(unifiedDialogRefMock);

        await service.promptForPremium();

        expect(UnifiedUpgradeDialogComponent.open).toHaveBeenCalledWith(dialogServiceMock, {
          data: {
            account: { id: "user-123" },
            planSelectionStepTitleOverride: "upgradeYourPlan",
            hideContinueWithoutUpgradingButton: true,
          },
        });
        expect(syncServiceMock.fullSync).toHaveBeenCalledWith(true);
      });

      it("should full sync when user upgrades to families", async () => {
        const unifiedDialogRefMock = {
          closed: of({ status: UnifiedUpgradeDialogStatus.UpgradedToFamilies }),
          close: jest.fn(),
        } as any;
        jest.spyOn(UnifiedUpgradeDialogComponent, "open").mockReturnValue(unifiedDialogRefMock);

        await service.promptForPremium();

        expect(UnifiedUpgradeDialogComponent.open).toHaveBeenCalledWith(dialogServiceMock, {
          data: {
            account: { id: "user-123" },
            planSelectionStepTitleOverride: "upgradeYourPlan",
            hideContinueWithoutUpgradingButton: true,
          },
        });
        expect(syncServiceMock.fullSync).toHaveBeenCalledWith(true);
      });

      it("should not refresh or sync when user closes dialog without upgrading", async () => {
        const unifiedDialogRefMock = {
          closed: of({ status: UnifiedUpgradeDialogStatus.Closed }),
          close: jest.fn(),
        } as any;
        jest.spyOn(UnifiedUpgradeDialogComponent, "open").mockReturnValue(unifiedDialogRefMock);

        await service.promptForPremium();

        expect(UnifiedUpgradeDialogComponent.open).toHaveBeenCalledWith(dialogServiceMock, {
          data: {
            account: { id: "user-123" },
            planSelectionStepTitleOverride: "upgradeYourPlan",
            hideContinueWithoutUpgradingButton: true,
          },
        });
        expect(apiServiceMock.refreshIdentityToken).not.toHaveBeenCalled();
        expect(syncServiceMock.fullSync).not.toHaveBeenCalled();
      });

      it("should not open new dialog if organizationId is provided", async () => {
        const organizationId = "test-org-id" as OrganizationId;
        dialogServiceMock.openSimpleDialog.mockReturnValue(lastValueFrom(of(true)));

        const openSpy = jest.spyOn(UnifiedUpgradeDialogComponent, "open");
        openSpy.mockClear();

        await service.promptForPremium(organizationId);

        expect(openSpy).not.toHaveBeenCalled();
        expect(dialogServiceMock.openSimpleDialog).toHaveBeenCalledWith({
          title: { key: "upgradeOrganization" },
          content: { key: "upgradeOrganizationDesc" },
          acceptButtonText: { key: "upgradeOrganization" },
          type: "info",
        });
      });
    });
  });
});
