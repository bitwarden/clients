import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

import { VaultOnboardingService as VaultOnboardingServiceAbstraction } from "./services/abstraction/vault-onboarding.service";
import { VaultOnboardingComponent } from "./vault-onboarding.component";

describe("VaultOnboardingComponent", () => {
  let component: VaultOnboardingComponent;
  let fixture: ComponentFixture<VaultOnboardingComponent>;
  let mockPlatformUtilsService: Partial<PlatformUtilsService>;
  let mockApiService: Partial<ApiService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockVaultOnboardingService: MockProxy<VaultOnboardingServiceAbstraction>;
  let setInstallExtLinkSpy: jest.SpyInstance;
  let mockConfigService: MockProxy<ConfigService>;
  const mockAccountService: FakeAccountService = mockAccountServiceWith(Utils.newGuid() as UserId);
  let mockStateProvider: Partial<StateProvider>;

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockApiService = {
      getProfile: jest.fn(),
    };
    mockVaultOnboardingService = mock<VaultOnboardingServiceAbstraction>();
    mockVaultOnboardingService.vaultOnboardingState$.mockReturnValue(
      of({
        createAccount: true,
        importData: false,
        installExtension: false,
      }),
    );
    mockConfigService = mock<ConfigService>();
    mockStateProvider = {
      getActive: jest.fn().mockReturnValue(
        of({
          createAccount: true,
          importData: false,
          installExtension: false,
        }),
      ),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: StateProvider, useValue: mockStateProvider },
      ],
    })
      .overrideComponent(VaultOnboardingComponent, {
        set: {
          providers: [
            { provide: VaultOnboardingServiceAbstraction, useValue: mockVaultOnboardingService },
          ],
        },
      })
      .compileComponents();
    fixture = TestBed.createComponent(VaultOnboardingComponent);
    component = fixture.componentInstance;
    setInstallExtLinkSpy = jest.spyOn(component, "setInstallExtLink");
    jest.spyOn(component, "checkCreationDate").mockResolvedValue(undefined);
    jest.spyOn(window, "postMessage").mockImplementation(jest.fn());
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    it("should call setInstallExtLink", async () => {
      await component.ngOnInit();
      expect(setInstallExtLinkSpy).toHaveBeenCalled();
    });
  });

  describe("show and hide onboarding component", () => {
    it("should set showOnboarding to true", async () => {
      await component.ngOnInit();
      expect((component as any).showOnboarding()).toBe(true);
    });

    it("should set showOnboarding to false if dismiss is clicked", async () => {
      await component.ngOnInit();
      await (component as any).hideOnboarding();
      expect((component as any).showOnboarding()).toBe(false);
    });
  });

  describe("setInstallExtLink", () => {
    it("should set extensionUrl to Chrome Web Store when isChrome is true", async () => {
      jest.spyOn((component as any).platformUtilsService, "isChrome").mockReturnValue(true);
      const expected =
        "https://chromewebstore.google.com/detail/bitwarden-password-manager/nngceckbapebfimnlniiiahkandclblb";
      await component.ngOnInit();
      expect(component.extensionUrl()).toEqual(expected);
    });

    it("should set extensionUrl to Firefox Store when isFirefox is true", async () => {
      jest.spyOn((component as any).platformUtilsService, "isFirefox").mockReturnValue(true);
      const expected = "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/";
      await component.ngOnInit();
      expect(component.extensionUrl()).toEqual(expected);
    });

    it("should set extensionUrl when isSafari is true", async () => {
      jest.spyOn((component as any).platformUtilsService, "isSafari").mockReturnValue(true);
      const expected = "https://apps.apple.com/us/app/bitwarden/id1352778147?mt=12";
      await component.ngOnInit();
      expect(component.extensionUrl()).toEqual(expected);
    });
  });

  describe("checkBrowserExtension", () => {
    it("should call getMessages when showOnboarding is true", () => {
      const messageEventSubject = new Subject<MessageEvent>();
      const messageEvent = new MessageEvent("message", {
        data: VaultMessages.HasBwInstalled,
      });
      const getMessagesSpy = jest.spyOn(component, "getMessages");

      (component as any).showOnboarding.set(true);
      component.checkForBrowserExtension();
      messageEventSubject.next(messageEvent);

      void fixture.whenStable().then(() => {
        expect(window.postMessage).toHaveBeenCalledWith({
          command: VaultMessages.checkBwInstalled,
        });
        expect(getMessagesSpy).toHaveBeenCalled();
      });
    });

    it("should set installExtension to true when hasBWInstalled command is passed", async () => {
      const saveCompletedTasksSpy = jest
        .spyOn((component as any).vaultOnboardingService, "setVaultOnboardingTasks")
        .mockReturnValue(Promise.resolve());

      const eventData = { data: { command: VaultMessages.HasBwInstalled } };

      (component as any).showOnboarding.set(true);

      await component.ngOnInit();
      await component.getMessages(eventData);

      expect(saveCompletedTasksSpy).toHaveBeenCalled();
    });

    it("should set showOnboarding to false when extension is detected and all other tasks are complete", async () => {
      jest
        .spyOn((component as any).vaultOnboardingService, "setVaultOnboardingTasks")
        .mockReturnValue(Promise.resolve());

      (component as any).vaultOnboardingService.vaultOnboardingState$ = jest
        .fn()
        .mockImplementation(() => {
          return of({
            createAccount: true,
            importData: true,
            installExtension: false,
          });
        });

      (component as any).showOnboarding.set(true);
      (component as any).onboardingTasks$ = (
        component as any
      ).vaultOnboardingService.vaultOnboardingState$();

      await component.getMessages({ data: { command: VaultMessages.HasBwInstalled } });

      expect((component as any).showOnboarding()).toBe(false);
    });
  });
});
