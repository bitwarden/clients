import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PremiumUpgradeNudgeService } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TwoFactorSetupComponent } from "./two-factor-setup.component";

const TWO_FACTOR_NUDGE_OPTIONS = {
  titleKey: "twoFactorUpgradeTitle",
  descriptionKey: "twoFactorUpgradeDescription",
};

describe("TwoFactorSetupComponent", () => {
  let fixture: ComponentFixture<TwoFactorSetupComponent>;
  let component: TwoFactorSetupComponent;
  let twoFactorService: MockProxy<TwoFactorService>;
  let premiumUpgradeNudgeService: MockProxy<PremiumUpgradeNudgeService>;
  let manageSpy: jest.SpyInstance;
  let disableSpy: jest.SpyInstance;

  const userId = "user-id" as UserId;

  async function setup({
    flagOn,
    isPremium,
    enabledProviders = [],
  }: {
    flagOn: boolean;
    isPremium: boolean;
    enabledProviders?: { type: TwoFactorProviderType; enabled: boolean }[];
  }) {
    twoFactorService = mock<TwoFactorService>();
    twoFactorService.getEnabledTwoFactorProviders.mockResolvedValue({
      data: enabledProviders,
    } as any);

    const policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(of(false));

    const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(isPremium));

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag) =>
      of((flag === FeatureFlag.PM42214_FeatureBasedUpgradePaths ? flagOn : false) as any),
    );
    configService.getFeatureFlag.mockImplementation(async (flag) =>
      flag === FeatureFlag.PM42214_FeatureBasedUpgradePaths ? flagOn : (false as any),
    );

    premiumUpgradeNudgeService = mock<PremiumUpgradeNudgeService>();

    await TestBed.configureTestingModule({
      imports: [TwoFactorSetupComponent],
      providers: [
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: PolicyService, useValue: policyService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: ConfigService, useValue: configService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: UserVerificationService, useValue: mock<UserVerificationService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: PremiumUpgradeNudgeService, useValue: premiumUpgradeNudgeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TwoFactorSetupComponent);
    component = fixture.componentInstance;
    manageSpy = jest.spyOn(component, "manage").mockResolvedValue();
    disableSpy = jest
      .spyOn(component, "disablePremium2faTypeForNonPremiumUser")
      .mockResolvedValue();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function actionButton(type: TwoFactorProviderType): HTMLButtonElement {
    const index = component.providers.findIndex((p) => p.type === type);
    const items = fixture.debugElement.queryAll(By.css("bit-item"));
    return items[index].query(By.css("[slot=end] button")).nativeElement;
  }

  async function click(type: TwoFactorProviderType) {
    actionButton(type).click();
    await fixture.whenStable();
  }

  const premiumProviders = [
    ["Yubikey", TwoFactorProviderType.Yubikey],
    ["Duo", TwoFactorProviderType.Duo],
  ] as const;

  const freeProviders = [
    ["Authenticator", TwoFactorProviderType.Authenticator],
    ["Email", TwoFactorProviderType.Email],
    ["WebAuthn", TwoFactorProviderType.WebAuthn],
  ] as const;

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe("flag on, free user", () => {
    beforeEach(async () => {
      await setup({ flagOn: true, isPremium: false });
    });

    describe.each(premiumProviders)("%s Manage", (_, type) => {
      it("is enabled", () => {
        expect(actionButton(type).getAttribute("aria-disabled")).not.toBe("true");
      });

      it("opens setup when the nudge gate resolves true", async () => {
        premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge.mockResolvedValue(true);

        await click(type);

        expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).toHaveBeenCalledWith(
          TWO_FACTOR_NUDGE_OPTIONS,
        );
        expect(manageSpy).toHaveBeenCalledWith(type);
      });

      it("does not open setup when the nudge gate resolves false", async () => {
        premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge.mockResolvedValue(false);

        await click(type);

        expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).toHaveBeenCalledWith(
          TWO_FACTOR_NUDGE_OPTIONS,
        );
        expect(manageSpy).not.toHaveBeenCalled();
      });

      it("does not open setup when the nudge gate rejects", async () => {
        premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge.mockRejectedValue(
          new Error("premium read failed"),
        );

        await expect(component.managePremiumProvider(type)).rejects.toThrow();

        expect(manageSpy).not.toHaveBeenCalled();
      });
    });

    it.each(freeProviders)("%s Manage opens setup without the nudge gate", async (_, type) => {
      await click(type);

      expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).not.toHaveBeenCalled();
      expect(manageSpy).toHaveBeenCalledWith(type);
    });
  });

  describe("flag off, free user", () => {
    beforeEach(async () => {
      await setup({ flagOn: false, isPremium: false });
    });

    it.each(premiumProviders)("%s Manage is disabled", (_, type) => {
      expect(actionButton(type).getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("flag off, Premium user", () => {
    beforeEach(async () => {
      await setup({ flagOn: false, isPremium: true });
    });

    it.each(premiumProviders)(
      "%s Manage is enabled and opens setup without the nudge gate",
      async (_, type) => {
        expect(actionButton(type).getAttribute("aria-disabled")).not.toBe("true");

        await click(type);

        expect(manageSpy).toHaveBeenCalledWith(type);
        expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).not.toHaveBeenCalled();
      },
    );
  });

  describe.each([
    ["on", true],
    ["off", false],
  ])("lapsed premium, flag %s", (_, flagOn) => {
    beforeEach(async () => {
      await setup({
        flagOn,
        isPremium: false,
        enabledProviders: [{ type: TwoFactorProviderType.Yubikey, enabled: true }],
      });
    });

    it("Disable calls disablePremium2faTypeForNonPremiumUser without the nudge gate", async () => {
      const button = actionButton(TwoFactorProviderType.Yubikey);
      expect(button.textContent.trim()).toBe("disable");

      await click(TwoFactorProviderType.Yubikey);

      expect(disableSpy).toHaveBeenCalledWith(TwoFactorProviderType.Yubikey);
      expect(manageSpy).not.toHaveBeenCalled();
      expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).not.toHaveBeenCalled();
    });
  });
});
