import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { VaultOnboardingMessages } from "@bitwarden/common/vault/enums/vault-onboarding.enum";

import { VaultOnboardingService as VaultOnboardingServiceAbstraction } from "./services/abstraction/vault-onboarding.service";
import { VaultOnboardingComponent } from "./vault-onboarding.component";

describe("VaultOnboardingComponent", () => {
  let component: VaultOnboardingComponent;
  let fixture: ComponentFixture<VaultOnboardingComponent>;
  let mockPlatformUtilsService: Partial<PlatformUtilsService>;
  let mockApiService: Partial<ApiService>;
  let mockPolicyService: MockProxy<PolicyService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockConfigService: MockProxy<ConfigServiceAbstraction>;
  let mockVaultOnboardingService: MockProxy<VaultOnboardingServiceAbstraction>;
  let mockStateProvider: Partial<StateProvider>;
  let setInstallExtLinkSpy: any;
  let individualVaultPolicyCheckSpy: any;

  beforeEach(() => {
    mockPolicyService = mock<PolicyService>();
    mockI18nService = mock<I18nService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockApiService = {
      getProfile: jest.fn(),
    };
    mockConfigService = mock<ConfigServiceAbstraction>();
    mockVaultOnboardingService = mock<VaultOnboardingServiceAbstraction>();
    mockStateProvider = {
      getActive: jest.fn().mockReturnValue(
        of({
          createAccount: true,
          importData: false,
          installExtension: false,
        }),
      ),
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.configureTestingModule({
      declarations: [],
      imports: [RouterTestingModule],
      providers: [
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: VaultOnboardingServiceAbstraction, useValue: mockVaultOnboardingService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ConfigServiceAbstraction, useValue: mockConfigService },
        { provide: StateProvider, useValue: mockStateProvider },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VaultOnboardingComponent);
    component = fixture.componentInstance;
    setInstallExtLinkSpy = jest.spyOn(component, "setInstallExtLink");
    individualVaultPolicyCheckSpy = jest
      .spyOn(component, "individualVaultPolicyCheck")
      .mockReturnValue(undefined);
    jest.spyOn(component, "checkCreationDate").mockReturnValue(null);
    jest.spyOn(window, "postMessage").mockImplementation(jest.fn());
    (component as any).vaultOnboardingService.vaultOnboardingState$ = of({
      createAccount: true,
      importData: false,
      installExtension: false,
    });
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    it("should call setInstallExtLink", async () => {
      await component.ngOnInit();
      expect(setInstallExtLinkSpy).toHaveBeenCalled();
    });

    it("should call individualVaultPolicyCheck", async () => {
      await component.ngOnInit();
      expect(individualVaultPolicyCheckSpy).toHaveBeenCalled();
    });
  });

  describe("show and hide onboarding component", () => {
    it("should set showOnboarding to true", async () => {
      await component.ngOnInit();
      expect((component as any).showOnboarding).toBe(true);
    });

    it("should set showOnboarding to false if dismiss is clicked", async () => {
      await component.ngOnInit();
      (component as any).hideOnboarding();
      expect((component as any).showOnboarding).toBe(false);
    });
  });

  describe("setInstallExtLink", () => {
    it("should set extensionUrl to Chrome Web Store when isChrome is true", async () => {
      jest.spyOn((component as any).platformUtilsService, "isChrome").mockReturnValue(true);
      const expected =
        "https://chrome.google.com/webstore/detail/bitwarden-free-password-m/nngceckbapebfimnlniiiahkandclblb";
      await component.ngOnInit();
      expect(component.extensionUrl).toEqual(expected);
    });

    it("should set extensionUrl to Firefox Store when isFirefox is true", async () => {
      jest.spyOn((component as any).platformUtilsService, "isFirefox").mockReturnValue(true);
      const expected = "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/";
      await component.ngOnInit();
      expect(component.extensionUrl).toEqual(expected);
    });

    it("should set extensionUrl when isSafari is true", async () => {
      jest.spyOn((component as any).platformUtilsService, "isSafari").mockReturnValue(true);
      const expected = "https://apps.apple.com/us/app/bitwarden/id1352778147?mt=12";
      await component.ngOnInit();
      expect(component.extensionUrl).toEqual(expected);
    });
  });

  describe("individualVaultPolicyCheck", () => {
    it("should set isIndividualPolicyVault to true", async () => {
      individualVaultPolicyCheckSpy.mockRestore();
      const spy = jest
        .spyOn((component as any).policyService, "policyAppliesToActiveUser$")
        .mockReturnValue(of(true));

      await component.individualVaultPolicyCheck();
      fixture.detectChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("checkBrowserExtension", () => {
    it("should call getMessages when showOnboarding is true", () => {
      const messageEventSubject = new Subject<MessageEvent>();
      const messageEvent = new MessageEvent("message", {
        data: VaultOnboardingMessages.HasBwInstalled,
      });
      const getMessagesSpy = jest.spyOn(component, "getMessages");

      (component as any).showOnboarding = true;
      component.checkForBrowserExtension();
      messageEventSubject.next(messageEvent);

      void fixture.whenStable().then(() => {
        expect(window.postMessage).toHaveBeenCalledWith({
          command: VaultOnboardingMessages.checkBwInstalled,
        });
        expect(getMessagesSpy).toHaveBeenCalled();
      });
    });

    it("should set installExtension to true when hasBWInstalled command is passed", async () => {
      const saveCompletedTasksSpy = jest.spyOn(
        (component as any).vaultOnboardingService,
        "setVaultOnboardingTasks",
      );

      (component as any).vaultOnboardingService.vaultOnboardingState$ = of({
        createAccount: true,
        importData: false,
        installExtension: false,
      });

      const eventData = { data: { command: VaultOnboardingMessages.HasBwInstalled } };

      (component as any).showOnboarding = true;

      await component.ngOnInit();
      await component.getMessages(eventData);

      expect(saveCompletedTasksSpy).toHaveBeenCalled();
    });
  });
});
