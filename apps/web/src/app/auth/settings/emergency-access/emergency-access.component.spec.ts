import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PremiumUpgradeNudgeService } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService, ToastService } from "@bitwarden/components";

import * as enMessages from "../../../../locales/en/messages.json";
import { HeaderModule } from "../../../layouts/header/header.module";
import { EmergencyAccessService } from "../../emergency-access";

import { EmergencyAccessAddEditComponent } from "./emergency-access-add-edit.component";
import { EmergencyAccessComponent } from "./emergency-access.component";

const EMERGENCY_CONTACT_NUDGE_OPTIONS = {
  titleKey: "emergencyContactUpgradeTitle",
  descriptionKey: "emergencyContactUpgradeDescription",
};

@Component({
  selector: "app-header",
  template: "<ng-content></ng-content>",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockWebHeaderComponent {}

describe("EmergencyAccessComponent", () => {
  let fixture: ComponentFixture<EmergencyAccessComponent>;
  let component: EmergencyAccessComponent;
  let premiumUpgradeNudgeService: MockProxy<PremiumUpgradeNudgeService>;
  let openAddEdit: jest.SpyInstance;

  const userId = "user-id" as UserId;

  async function setup({ flagOn, isPremium }: { flagOn: boolean; isPremium: boolean }) {
    const emergencyAccessService = mock<EmergencyAccessService>();
    emergencyAccessService.getEmergencyAccessTrusted.mockResolvedValue([]);
    emergencyAccessService.getEmergencyAccessGranted.mockResolvedValue([]);

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));

    const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(isPremium));

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation(((key: FeatureFlag) =>
      of(
        key === FeatureFlag.PM42214_FeatureBasedUpgradePaths ? flagOn : false,
      )) as typeof configService.getFeatureFlag$);

    premiumUpgradeNudgeService = mock<PremiumUpgradeNudgeService>();

    openAddEdit = jest
      .spyOn(EmergencyAccessAddEditComponent, "open")
      .mockReturnValue({ closed: of(undefined) } as any);

    await TestBed.configureTestingModule({
      imports: [EmergencyAccessComponent],
      providers: [
        { provide: EmergencyAccessService, useValue: emergencyAccessService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
        { provide: ConfigService, useValue: configService },
        { provide: PremiumUpgradeNudgeService, useValue: premiumUpgradeNudgeService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: StateService, useValue: mock<StateService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: OrganizationManagementPreferencesService,
          useValue: mock<OrganizationManagementPreferencesService>(),
        },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
      ],
    })
      .overrideComponent(EmergencyAccessComponent, {
        remove: { imports: [HeaderModule] },
        add: { imports: [MockWebHeaderComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EmergencyAccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function addButton(): HTMLButtonElement {
    return fixture.debugElement.query(By.css("button[bitButton]")).nativeElement;
  }

  async function clickAdd() {
    addButton().click();
    await fixture.whenStable();
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("flag on, free user", () => {
    beforeEach(async () => {
      await setup({ flagOn: true, isPremium: false });
    });

    it("enables Add emergency contact", () => {
      expect(addButton().hasAttribute("aria-disabled")).toBe(false);
    });

    it("shows the upgrade nudge and does not open add/edit when the gate resolves false", async () => {
      premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge.mockResolvedValue(false);

      await clickAdd();

      expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).toHaveBeenCalledTimes(1);
      expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).toHaveBeenCalledWith(
        EMERGENCY_CONTACT_NUDGE_OPTIONS,
      );
      expect(openAddEdit).not.toHaveBeenCalled();
    });

    it("does not open add/edit when the gate rejects", async () => {
      premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge.mockRejectedValue(
        new Error("premium read failed"),
      );

      await expect(component.invite()).rejects.toThrow("premium read failed");

      expect(openAddEdit).not.toHaveBeenCalled();
    });
  });

  describe("flag on, Premium user", () => {
    beforeEach(async () => {
      await setup({ flagOn: true, isPremium: true });
    });

    it("opens add/edit when the gate resolves true", async () => {
      premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge.mockResolvedValue(true);

      await clickAdd();

      expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).toHaveBeenCalledTimes(1);
      expect(openAddEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe("flag off, free user", () => {
    beforeEach(async () => {
      await setup({ flagOn: false, isPremium: false });
    });

    it("disables Add emergency contact", () => {
      expect(addButton().getAttribute("aria-disabled")).toBe("true");
    });

    it("does not call the nudge gate", async () => {
      await component.invite();

      expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).not.toHaveBeenCalled();
    });
  });

  describe("flag off, Premium user", () => {
    beforeEach(async () => {
      await setup({ flagOn: false, isPremium: true });
    });

    it("enables Add emergency contact and opens add/edit without the nudge gate", async () => {
      expect(addButton().hasAttribute("aria-disabled")).toBe(false);

      await clickAdd();

      expect(openAddEdit).toHaveBeenCalledTimes(1);
      expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).not.toHaveBeenCalled();
    });
  });

  describe("nudge copy", () => {
    it("matches the design", () => {
      expect(enMessages.emergencyContactUpgradeTitle.message).toBe(
        "Add a trusted contact as a backup",
      );
      expect(enMessages.emergencyContactUpgradeDescription.message).toBe(
        "Designate a trusted person to access your vault in an emergency where you are locked out.",
      );
    });
  });
});
