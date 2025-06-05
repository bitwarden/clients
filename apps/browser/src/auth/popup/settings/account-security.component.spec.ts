import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutService,
  VaultTimeoutStringType,
  VaultTimeoutAction,
} from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { BiometricStateService, BiometricsService, KeyService } from "@bitwarden/key-management";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { AccountSecurityComponent } from "./account-security.component";

@Component({
  selector: "app-pop-out",
  template: ` <ng-content></ng-content>`,
})
class MockPopOutComponent {}

describe("AccountSecurityComponent", () => {
  let component: AccountSecurityComponent;
  let fixture: ComponentFixture<AccountSecurityComponent>;

  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const biometricStateService = mock<BiometricStateService>();
  const policyService = mock<PolicyService>();
  const pinServiceAbstraction = mock<PinServiceAbstraction>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AccountSecurityComponent, useValue: mock<AccountSecurityComponent>() },
        { provide: BiometricsService, useValue: mock<BiometricsService>() },
        { provide: BiometricStateService, useValue: biometricStateService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: MessageSender, useValue: mock<MessageSender>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PinServiceAbstraction, useValue: pinServiceAbstraction },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: PolicyService, useValue: policyService },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
        { provide: StateService, useValue: mock<StateService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: UserVerificationService, useValue: mock<UserVerificationService>() },
        { provide: VaultTimeoutService, useValue: mock<VaultTimeoutService>() },
        { provide: VaultTimeoutSettingsService, useValue: vaultTimeoutSettingsService },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
      ],
    })
      .overrideComponent(AccountSecurityComponent, {
        remove: {
          imports: [PopOutComponent],
        },
        add: {
          imports: [MockPopOutComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AccountSecurityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      of(VaultTimeoutStringType.OnLocked),
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );
    biometricStateService.promptAutomatically$ = of(false);
    pinServiceAbstraction.isPinSet.mockResolvedValue(false);
  });

  it("pin enabled when RemoveUnlockWithPin policy is not set", async () => {
    // @ts-strict-ignore
    policyService.policiesByType$.mockReturnValue(of([null]));

    await component.ngOnInit();

    await expect(firstValueFrom(component.pinEnabled$)).resolves.toBe(true);
  });

  it("pin enabled when RemoveUnlockWithPin policy is disabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = false;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();

    await expect(firstValueFrom(component.pinEnabled$)).resolves.toBe(true);

    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin disabled when RemoveUnlockWithPin policy is enabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();

    await expect(firstValueFrom(component.pinEnabled$)).resolves.toBe(false);

    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).toBeNull();
  });

  it("pin visible when RemoveUnlockWithPin policy is not set", async () => {
    // @ts-strict-ignore
    policyService.policiesByType$.mockReturnValue(of([null]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin visible when RemoveUnlockWithPin policy is disabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = false;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin visible when RemoveUnlockWithPin policy is enabled and pin set", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    pinServiceAbstraction.isPinSet.mockResolvedValue(true);

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).not.toBeNull();
    expect(pinInputElement.name).toBe("input");
  });

  it("pin not visible when RemoveUnlockWithPin policy is enabled", async () => {
    const policy = new Policy();
    policy.type = PolicyType.RemoveUnlockWithPin;
    policy.enabled = true;

    policyService.policiesByType$.mockReturnValue(of([policy]));

    await component.ngOnInit();
    fixture.detectChanges();

    const pinInputElement = fixture.debugElement.query(By.css("#pin"));
    expect(pinInputElement).toBeNull();
  });
});
