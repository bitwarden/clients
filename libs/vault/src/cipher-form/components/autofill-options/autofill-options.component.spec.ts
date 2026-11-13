import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { DESKTOP_APP_URI_PREFIX } from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { CipherFormContainer } from "../../cipher-form-container";
import { CipherFormHTTPAuthenticationService } from "../../services/cipher-form-http-authentication.service";

import { AutofillOptionsComponent } from "./autofill-options.component";
import { DesktopAppRow, UriOptionComponent } from "./uri-option.component";

jest.mock("@angular/cdk/drag-drop", () => {
  const actual = jest.requireActual("@angular/cdk/drag-drop");
  return {
    ...actual,
    moveItemInArray: jest.fn(actual.moveItemInArray),
  };
});

describe("AutofillOptionsComponent", () => {
  let component: AutofillOptionsComponent;
  let fixture: ComponentFixture<AutofillOptionsComponent>;

  let cipherFormContainer: MockProxy<CipherFormContainer>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;
  let domainSettingsService: MockProxy<DomainSettingsService>;
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let configService: MockProxy<ConfigService>;
  let httpAuthenticationService: MockProxy<CipherFormHTTPAuthenticationService>;
  let mvpFeatureFlagSubject: BehaviorSubject<boolean>;
  let gaFeatureFlagSubject: BehaviorSubject<boolean>;
  const getInitialCipherView = jest.fn((): any => null);
  const formStatusChange$ = new BehaviorSubject<"enabled" | "disabled">("enabled");

  beforeEach(async () => {
    getInitialCipherView.mockClear();
    cipherFormContainer = mock<CipherFormContainer>({ getInitialCipherView });
    cipherFormContainer.formStatusChange$ = formStatusChange$.asObservable();
    liveAnnouncer = mock<LiveAnnouncer>();
    platformUtilsService = mock<PlatformUtilsService>();
    mvpFeatureFlagSubject = new BehaviorSubject<boolean>(false);
    gaFeatureFlagSubject = new BehaviorSubject<boolean>(false);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
      flag === FeatureFlag.WindowsDesktopAutotypeGA ? gaFeatureFlagSubject : mvpFeatureFlagSubject,
    );
    domainSettingsService = mock<DomainSettingsService>();
    domainSettingsService.resolvedDefaultUriMatchStrategy$ = new BehaviorSubject(null);

    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    autofillSettingsService.autofillOnPageLoadDefault$ = new BehaviorSubject(false);
    autofillSettingsService.autofillOnPageLoad$ = new BehaviorSubject(true);

    httpAuthenticationService = mock<CipherFormHTTPAuthenticationService>();
    httpAuthenticationService.confirmDefaultMatchStrategy.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AutofillOptionsComponent],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormContainer },
        {
          provide: I18nService,
          useValue: { t: (...keys: string[]) => keys.filter(Boolean).join(" ") },
        },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
        { provide: DomainSettingsService, useValue: domainSettingsService },
        { provide: AutofillSettingsServiceAbstraction, useValue: autofillSettingsService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ConfigService, useValue: configService },
        { provide: CipherFormHTTPAuthenticationService, useValue: httpAuthenticationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AutofillOptionsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("registers 'autoFillOptionsForm' form with CipherFormContainer", () => {
    fixture.detectChanges();
    expect(cipherFormContainer.registerChildForm).toHaveBeenCalledWith(
      "autoFillOptions",
      component.autofillOptionsForm,
    );
  });

  it("patches 'autoFillOptionsForm' changes to CipherFormContainer", () => {
    fixture.detectChanges();

    component.autofillOptionsForm.patchValue({
      uris: [{ uri: "https://example.com", matchDetection: UriMatchStrategy.Exact }],
      autofillOnPageLoad: true,
    });

    expect(cipherFormContainer.patchCipher).toHaveBeenCalled();
    const patchFn = cipherFormContainer.patchCipher.mock.lastCall[0];

    const updatedCipher = patchFn(new CipherView());

    const expectedUri = Object.assign(new LoginUriView(), {
      uri: "https://example.com",
      match: UriMatchStrategy.Exact,
    } as LoginUriView);

    expect(updatedCipher.login.uris).toEqual([expectedUri]);
    expect(updatedCipher.login.autofillOnPageLoad).toEqual(true);
  });

  it("disables 'autoFillOptionsForm' when in partial-edit mode", () => {
    cipherFormContainer.config.mode = "partial-edit";

    fixture.detectChanges();

    expect(component.autofillOptionsForm.disabled).toBe(true);
  });

  it("initializes 'autoFillOptionsForm' with original login view values", () => {
    const existingLogin = new LoginUriView();
    existingLogin.uri = "https://example.com";
    existingLogin.match = UriMatchStrategy.Exact;

    const cipher = new CipherView();
    cipher.login = {
      autofillOnPageLoad: true,
      uris: [existingLogin],
    } as LoginView;

    getInitialCipherView.mockReturnValueOnce(cipher);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: UriMatchStrategy.Exact },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(true);
  });

  it("initializes 'autoFillOptionsForm' with initialValues when creating a new cipher", () => {
    cipherFormContainer.config.initialValues = { loginUri: "https://example.com" };

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: null },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(null);
  });

  it("initializes 'autoFillOptionsForm' with initialValues when editing an existing cipher", () => {
    cipherFormContainer.config.initialValues = { loginUri: "https://new-website.com" };
    const existingLogin = new LoginUriView();
    existingLogin.uri = "https://example.com";
    existingLogin.match = UriMatchStrategy.Exact;

    const cipher = new CipherView();
    cipher.login = {
      autofillOnPageLoad: true,
      uris: [existingLogin],
    } as LoginView;

    getInitialCipherView.mockReturnValueOnce(cipher);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: UriMatchStrategy.Exact },
      { uri: "https://new-website.com", matchDetection: null },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(true);
  });

  it("initializes 'autoFillOptionsForm' with initialValues without duplicating an existing URI", () => {
    cipherFormContainer.config.initialValues = { loginUri: "https://example.com" };
    const existingLogin = new LoginUriView();
    existingLogin.uri = "https://example.com";
    existingLogin.match = UriMatchStrategy.Exact;

    const cipher = new CipherView();
    cipher.login = {
      autofillOnPageLoad: true,
      uris: [existingLogin],
    } as LoginView;

    getInitialCipherView.mockReturnValueOnce(cipher);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: UriMatchStrategy.Exact },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(true);
  });

  it("initializes 'autoFillOptionsForm' with an empty URI when creating a new cipher", () => {
    cipherFormContainer.config.initialValues = null;

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([{ uri: null, matchDetection: null }]);
  });

  it("updates the default autofill on page load label", () => {
    fixture.detectChanges();
    expect(component["autofillOptions"][0].label).toEqual("defaultLabelWithValue no");

    (autofillSettingsService.autofillOnPageLoadDefault$ as BehaviorSubject<boolean>).next(true);
    fixture.detectChanges();

    expect(component["autofillOptions"][0].label).toEqual("defaultLabelWithValue yes");
  });

  it("hides the autofill on page load field when the setting is disabled", () => {
    fixture.detectChanges();
    let control = fixture.nativeElement.querySelector(
      "bit-select[formControlName='autofillOnPageLoad']",
    );
    expect(control).toBeTruthy();

    (autofillSettingsService.autofillOnPageLoad$ as BehaviorSubject<boolean>).next(false);

    fixture.detectChanges();
    control = fixture.nativeElement.querySelector(
      "bit-select[formControlName='autofillOnPageLoad']",
    );
    expect(control).toBeFalsy();
  });

  it("announces the addition of a new URI input", fakeAsync(() => {
    fixture.detectChanges();

    // Mock the liveAnnouncer implementation so we can resolve it manually
    let resolveAnnouncer: () => void;
    jest.spyOn(liveAnnouncer, "announce").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAnnouncer = resolve;
        }),
    );

    component.addUri(undefined, true);
    fixture.detectChanges();

    expect(liveAnnouncer.announce).toHaveBeenCalledWith("websiteAdded", "polite");

    // Spy on the last URI input's focusInput method to ensure it is called
    jest.spyOn(component["uriOptions"].last, "focusInput");
    resolveAnnouncer(); // Resolve the liveAnnouncer promise so that focusOnNewInput$ pipe can continue
    tick();

    expect(component["uriOptions"].last.focusInput).toHaveBeenCalled();
  }));

  it("removes URI input when remove() is called", () => {
    fixture.detectChanges();

    // Add second Uri
    component.addUri(undefined, true);

    fixture.detectChanges();

    // Remove first Uri
    component.removeUri(0);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris.length).toEqual(1);
  });

  it("does not emit events when status changes to prevent a `valueChanges` call", () => {
    fixture.detectChanges();

    const enable = jest.spyOn(component.autofillOptionsForm, "enable");
    const disable = jest.spyOn(component.autofillOptionsForm, "disable");

    formStatusChange$.next("disabled");
    fixture.detectChanges();

    expect(disable).toHaveBeenCalledWith({ emitEvent: false });

    formStatusChange$.next("enabled");
    fixture.detectChanges();

    expect(enable).toHaveBeenCalledWith({ emitEvent: false });
  });

  describe("HTTP authentication", () => {
    it("shares the URI match strategies when initialized from an existing cipher", () => {
      getInitialCipherView.mockReturnValueOnce({
        login: Object.assign(new LoginView(), {
          uris: [
            Object.assign(new LoginUriView(), {
              uri: "https://example.com",
              match: UriMatchStrategy.Host,
            }),
            Object.assign(new LoginUriView(), { uri: "https://example.org", match: null }),
          ],
        }),
      });

      fixture.detectChanges();

      expect(httpAuthenticationService.updateUriMatchStrategies).toHaveBeenLastCalledWith([
        UriMatchStrategy.Host,
        null,
      ]);
    });

    it("shares the URI match strategies when the URIs change", () => {
      fixture.detectChanges();

      component.autofillOptionsForm.controls.uris.at(0).setValue({
        uri: "https://example.com",
        matchDetection: UriMatchStrategy.Exact,
      });

      expect(httpAuthenticationService.updateUriMatchStrategies).toHaveBeenLastCalledWith([
        UriMatchStrategy.Exact,
      ]);
    });

    it("adds a URI requested by the user when the default match strategy is confirmed", async () => {
      fixture.detectChanges();

      await component.addUriFromUser({ uri: null, matchDetection: null });

      expect(httpAuthenticationService.confirmDefaultMatchStrategy).toHaveBeenCalled();
      expect(component.autofillOptionsForm.value.uris.length).toEqual(2);
    });

    it("does not add a URI requested by the user when the default match strategy is declined", async () => {
      httpAuthenticationService.confirmDefaultMatchStrategy.mockResolvedValue(false);
      fixture.detectChanges();

      await component.addUriFromUser({ uri: null, matchDetection: null });

      expect(component.autofillOptionsForm.value.uris.length).toEqual(1);
    });

    it("adds a desktop app URI requested by the user with the Never match strategy", async () => {
      fixture.detectChanges();

      await component.addDesktopAppUriFromUser();

      expect(component.autofillOptionsForm.value.uris[1]).toEqual({
        uri: DESKTOP_APP_URI_PREFIX,
        matchDetection: UriMatchStrategy.Never,
      });
    });

    it("adds a desktop app URI requested by the user without confirming the default match strategy", async () => {
      httpAuthenticationService.confirmDefaultMatchStrategy.mockResolvedValue(false);
      fixture.detectChanges();

      await component.addDesktopAppUriFromUser();

      expect(httpAuthenticationService.confirmDefaultMatchStrategy).not.toHaveBeenCalled();
      expect(component.autofillOptionsForm.value.uris.length).toEqual(2);
    });

    it("shares the Never match strategy of a desktop app URI as an explicit match strategy", async () => {
      fixture.detectChanges();
      component.autofillOptionsForm.controls.uris.at(0).setValue({
        uri: "https://example.com",
        matchDetection: UriMatchStrategy.Exact,
      });

      await component.addDesktopAppUriFromUser();

      expect(httpAuthenticationService.updateUriMatchStrategies).toHaveBeenLastCalledWith([
        UriMatchStrategy.Exact,
        UriMatchStrategy.Never,
      ]);
    });
  });

  // Autotype App Tests
  describe("recognizeDesktopApps", () => {
    function createComponent(deviceType: DeviceType) {
      platformUtilsService.getDevice.mockReturnValue(deviceType);
      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      localFixture.detectChanges();
      return localFixture;
    }

    it("is false when the windows-desktop-autotype-ga feature flag is off", () => {
      const localFixture = createComponent(DeviceType.WindowsDesktop);

      expect(localFixture.componentInstance["recognizeDesktopApps"]()).toBe(false);
    });

    it.each([
      DeviceType.WindowsDesktop,
      DeviceType.MacOsDesktop,
      DeviceType.LinuxDesktop,
      DeviceType.ChromeExtension,
      DeviceType.FirefoxExtension,
      DeviceType.ChromeBrowser,
    ])(
      "is true on device type %p when the windows-desktop-autotype-ga feature flag is on",
      (deviceType) => {
        gaFeatureFlagSubject.next(true);

        const localFixture = createComponent(deviceType);

        expect(localFixture.componentInstance["recognizeDesktopApps"]()).toBe(true);
      },
    );

    it("is false when both the MVP and GA feature flags are enabled", () => {
      mvpFeatureFlagSubject.next(true);
      gaFeatureFlagSubject.next(true);

      const localFixture = createComponent(DeviceType.WindowsDesktop);

      expect(localFixture.componentInstance["recognizeDesktopApps"]()).toBe(false);
    });

    it("is passed to the URI options so they recognize desktop apps on any client", () => {
      gaFeatureFlagSubject.next(true);

      const localFixture = createComponent(DeviceType.MacOsDesktop);

      const uriOption = localFixture.debugElement.query(By.directive(UriOptionComponent));
      expect(uriOption.componentInstance.recognizeDesktopApps()).toBe(true);
    });
  });

  describe("showAddAppDropdown", () => {
    it("is false when device type is not Windows Desktop", () => {
      fixture.detectChanges();

      expect(component["showAddAppDropdown"]()).toBe(false);
    });

    it.each([
      DeviceType.MacOsDesktop,
      DeviceType.LinuxDesktop,
      DeviceType.ChromeExtension,
      DeviceType.ChromeBrowser,
    ])(
      "is false on device type %p even when the windows-desktop-autotype-ga feature flag is on",
      (deviceType) => {
        platformUtilsService.getDevice.mockReturnValue(deviceType);
        gaFeatureFlagSubject.next(true);

        const localFixture = TestBed.createComponent(AutofillOptionsComponent);
        localFixture.detectChanges();

        expect(localFixture.componentInstance["showAddAppDropdown"]()).toBe(false);
      },
    );

    it("is false when device type is Windows Desktop but windows-desktop-autotype-ga feature flag is off", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
        flag === FeatureFlag.WindowsDesktopAutotypeGA
          ? gaFeatureFlagSubject
          : mvpFeatureFlagSubject,
      );

      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      localFixture.detectChanges();

      expect(localFixture.componentInstance["showAddAppDropdown"]()).toBe(false);
    });

    it("is false when device is Windows Desktop and only the MVP feature flag is enabled", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
        flag === FeatureFlag.WindowsDesktopAutotypeGA
          ? gaFeatureFlagSubject
          : mvpFeatureFlagSubject,
      );

      mvpFeatureFlagSubject.next(true);

      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      localFixture.detectChanges();

      expect(localFixture.componentInstance["showAddAppDropdown"]()).toBe(false);
    });

    it("is true when device is Windows Desktop and windows-desktop-autotype-ga feature flag is on", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
        flag === FeatureFlag.WindowsDesktopAutotypeGA
          ? gaFeatureFlagSubject
          : mvpFeatureFlagSubject,
      );

      gaFeatureFlagSubject.next(true);

      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      localFixture.detectChanges();

      expect(localFixture.componentInstance["showAddAppDropdown"]()).toBe(true);
    });

    it("is false when device is Windows Desktop and both the MVP and GA feature flags are enabled", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
        flag === FeatureFlag.WindowsDesktopAutotypeGA
          ? gaFeatureFlagSubject
          : mvpFeatureFlagSubject,
      );

      mvpFeatureFlagSubject.next(true);
      gaFeatureFlagSubject.next(true);

      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      localFixture.detectChanges();

      expect(localFixture.componentInstance["showAddAppDropdown"]()).toBe(false);
    });
  });

  // Autotype App Tests
  describe("Add URI button", () => {
    it("renders a plain 'Add website' button when showAddAppDropdown is false", () => {
      fixture.detectChanges();

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll("button"),
      ) as HTMLButtonElement[];
      const addWebsiteBtn = buttons.find((btn) => btn.textContent?.trim() === "addWebsite");
      const menu = fixture.nativeElement.querySelector("bit-menu");

      expect(addWebsiteBtn).toBeTruthy();
      expect(menu).toBeFalsy();
    });

    it("renders an 'Add website or app' dropdown button with 'Website' and 'Desktop app' options when showAddAppDropdown is true", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
        flag === FeatureFlag.WindowsDesktopAutotypeGA
          ? gaFeatureFlagSubject
          : mvpFeatureFlagSubject,
      );

      gaFeatureFlagSubject.next(true);

      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      localFixture.detectChanges();

      // Verify the trigger button is present
      const triggerBtn = Array.from(localFixture.nativeElement.querySelectorAll("button")).find(
        (btn: HTMLButtonElement) => btn.textContent?.trim() === "addWebsiteOrApp",
      ) as HTMLButtonElement;
      expect(triggerBtn).toBeTruthy();

      // Open the menu
      triggerBtn.click();
      localFixture.detectChanges();

      // Verify both options are present in the dropdown
      const menuButtons = Array.from(
        document.querySelectorAll(".cdk-overlay-container button"),
      ) as HTMLButtonElement[];
      const websiteBtn = menuButtons.find((btn) => btn.textContent?.trim() === "website");
      const appBtn = menuButtons.find((btn) => btn.textContent?.trim() === "desktopApp");

      expect(websiteBtn).toBeTruthy();
      expect(appBtn).toBeTruthy();
    });

    it("clicking 'Desktop app' menu item calls addUri with the desktopapp:// prefix", async () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
        flag === FeatureFlag.WindowsDesktopAutotypeGA
          ? gaFeatureFlagSubject
          : mvpFeatureFlagSubject,
      );
      gaFeatureFlagSubject.next(true);

      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      jest.spyOn(localComponent, "addUri");

      // Open the menu by clicking the trigger button
      const triggerBtn = Array.from(localFixture.nativeElement.querySelectorAll("button")).find(
        (btn: HTMLButtonElement) => btn.textContent?.trim() === "addWebsiteOrApp",
      ) as HTMLButtonElement;
      expect(triggerBtn).toBeTruthy();
      triggerBtn.click();
      localFixture.detectChanges();

      // Menu content is rendered in the CDK overlay portal, not in the component's DOM
      const menuButtons = Array.from(
        document.querySelectorAll(".cdk-overlay-container button"),
      ) as HTMLButtonElement[];
      const appBtn = menuButtons.find((btn) => btn.textContent?.trim() === "desktopApp");
      expect(appBtn).toBeTruthy();
      appBtn.click();
      await localFixture.whenStable();

      expect(localComponent.addUri).toHaveBeenCalledWith(
        { uri: DESKTOP_APP_URI_PREFIX, matchDetection: UriMatchStrategy.Never },
        true,
        true,
        DesktopAppRow.New,
      );
    });
  });

  describe("desktop app rows", () => {
    const pairingUri = `${DESKTOP_APP_URI_PREFIX}autotype?version=1.0.0&data=e30`;

    function createCipher(...uris: [string, UriMatchStrategySetting][]) {
      const cipher = new CipherView();
      cipher.login = Object.assign(new LoginView(), {
        uris: uris.map(([uri, match]) => Object.assign(new LoginUriView(), { uri, match })),
      });
      return cipher;
    }

    function createComponent(gaEnabled: boolean, cipher: CipherView | null = null) {
      gaFeatureFlagSubject.next(gaEnabled);
      getInitialCipherView.mockReturnValueOnce(cipher);
      const localFixture = TestBed.createComponent(AutofillOptionsComponent);
      localFixture.detectChanges();
      return localFixture;
    }

    function getDesktopAppRows(localFixture: ComponentFixture<AutofillOptionsComponent>) {
      return localFixture.debugElement
        .queryAll(By.directive(UriOptionComponent))
        .map((uriOption) => uriOption.componentInstance.desktopAppRow());
    }

    function getSavedUris() {
      const patchFn = cipherFormContainer.patchCipher.mock.lastCall[0];
      return patchFn(new CipherView()).login.uris.map((uri: LoginUriView) => ({
        uri: uri.uri,
        match: uri.match,
      }));
    }

    it("loads lowercase desktop app URIs on the cipher as saved desktop app rows", () => {
      const localFixture = createComponent(
        true,
        createCipher(
          ["https://example.com", null],
          [pairingUri, UriMatchStrategy.Never],
          ["DESKTOPAPP://autotype", null],
        ),
      );

      expect(getDesktopAppRows(localFixture)).toEqual([null, DesktopAppRow.Saved, null]);
    });

    it("loads desktop app URIs on the cipher as saved desktop app rows when the feature flag is off", () => {
      const localFixture = createComponent(false, createCipher([pairingUri, null]));

      expect(getDesktopAppRows(localFixture)).toEqual([DesktopAppRow.Saved]);
      expect(localFixture.componentInstance["recognizeDesktopApps"]()).toBe(false);
    });

    it("adds a desktop app requested by the user as a new desktop app row", async () => {
      const localFixture = createComponent(true);

      await localFixture.componentInstance.addDesktopAppUriFromUser();
      localFixture.detectChanges();

      expect(getDesktopAppRows(localFixture)).toEqual([null, DesktopAppRow.New]);
    });

    it("adds a website requested by the user as a website row", async () => {
      const localFixture = createComponent(true);

      await localFixture.componentInstance.addUriFromUser({ uri: null, matchDetection: null });
      localFixture.detectChanges();

      expect(getDesktopAppRows(localFixture)).toEqual([null, null]);
    });

    it("adds a prefilled desktop app URI to a new cipher as a website row", () => {
      cipherFormContainer.config.initialValues = { loginUri: pairingUri };

      const localFixture = createComponent(true);

      expect(getDesktopAppRows(localFixture)).toEqual([null]);
    });

    it("adds a prefilled desktop app URI to an existing cipher as a website row", () => {
      cipherFormContainer.config.initialValues = { loginUri: pairingUri };

      const localFixture = createComponent(
        true,
        createCipher(["https://example.com", UriMatchStrategy.Exact]),
      );

      expect(getDesktopAppRows(localFixture)).toEqual([null, null]);
    });

    it("keeps a website row when a desktop app URI is typed into it", () => {
      const localFixture = createComponent(true);

      localFixture.componentInstance.autofillOptionsForm.controls.uris
        .at(0)
        .setValue({ uri: pairingUri, matchDetection: null });
      localFixture.detectChanges();

      expect(getDesktopAppRows(localFixture)).toEqual([null]);
    });

    it("keeps each row's type when the rows are reordered", () => {
      const localFixture = createComponent(
        true,
        createCipher(["https://example.com", null], [pairingUri, UriMatchStrategy.Never]),
      );

      localFixture.componentInstance.onUriItemDrop({
        previousIndex: 1,
        currentIndex: 0,
      } as CdkDragDrop<HTMLDivElement>);
      localFixture.detectChanges();

      expect(getDesktopAppRows(localFixture)).toEqual([DesktopAppRow.Saved, null]);
    });

    describe("feature flag", () => {
      it("keeps recognizing desktop apps when the feature flag turns off while the form is open", () => {
        platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
        const localFixture = createComponent(true);

        gaFeatureFlagSubject.next(false);
        localFixture.detectChanges();

        expect(localFixture.componentInstance["recognizeDesktopApps"]()).toBe(true);
        expect(localFixture.componentInstance["showAddAppDropdown"]()).toBe(true);
      });

      it("keeps not recognizing desktop apps when the feature flag turns on while the form is open", () => {
        platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
        const localFixture = createComponent(false);

        gaFeatureFlagSubject.next(true);
        localFixture.detectChanges();

        expect(localFixture.componentInstance["recognizeDesktopApps"]()).toBe(false);
        expect(localFixture.componentInstance["showAddAppDropdown"]()).toBe(false);
      });
    });

    describe("saved match strategy", () => {
      it("saves a desktop app URI typed into a website row with the Never match strategy", () => {
        const localFixture = createComponent(true);

        localFixture.componentInstance.autofillOptionsForm.controls.uris
          .at(0)
          .setValue({ uri: pairingUri, matchDetection: null });

        expect(getSavedUris()).toEqual([{ uri: pairingUri, match: UriMatchStrategy.Never }]);
      });

      it("saves a desktop app URI typed into a website row with its match strategy when the feature flag is off", () => {
        const localFixture = createComponent(false);

        localFixture.componentInstance.autofillOptionsForm.controls.uris
          .at(0)
          .setValue({ uri: pairingUri, matchDetection: null });

        expect(getSavedUris()).toEqual([{ uri: pairingUri, match: null }]);
      });

      it("keeps the form's match strategy of a desktop app URI typed into a website row", () => {
        const localFixture = createComponent(true);
        const control = localFixture.componentInstance.autofillOptionsForm.controls.uris.at(0);

        control.setValue({ uri: pairingUri, matchDetection: UriMatchStrategy.Host });

        expect(control.value.matchDetection).toBe(UriMatchStrategy.Host);
        expect(httpAuthenticationService.updateUriMatchStrategies).toHaveBeenLastCalledWith([
          UriMatchStrategy.Host,
        ]);
      });

      it("saves the desktop app URIs on the cipher with the Never match strategy when the form opens", () => {
        createComponent(
          true,
          createCipher(["https://example.com", UriMatchStrategy.Exact], [pairingUri, null]),
        );

        expect(getSavedUris()).toEqual([
          { uri: "https://example.com", match: UriMatchStrategy.Exact },
          { uri: pairingUri, match: UriMatchStrategy.Never },
        ]);
      });

      it("saves the desktop app URIs on the cipher with their match strategy when the feature flag is off", () => {
        createComponent(
          false,
          createCipher(["https://example.com", UriMatchStrategy.Exact], [pairingUri, null]),
        );

        expect(getSavedUris()).toEqual([
          { uri: "https://example.com", match: UriMatchStrategy.Exact },
          { uri: pairingUri, match: null },
        ]);
      });

      describe("when the feature flag is read after the form opens", () => {
        let gaFeatureFlag$: Subject<boolean>;

        beforeEach(() => {
          gaFeatureFlag$ = new Subject<boolean>();
          configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
            flag === FeatureFlag.WindowsDesktopAutotypeGA ? gaFeatureFlag$ : mvpFeatureFlagSubject,
          );
        });

        function openForm(...uris: [string, UriMatchStrategySetting][]) {
          getInitialCipherView.mockReturnValueOnce(createCipher(...uris));
          TestBed.createComponent(AutofillOptionsComponent).detectChanges();
          cipherFormContainer.patchCipher.mockClear();
        }

        it("saves the desktop app URIs on the cipher with the Never match strategy", () => {
          openForm(["https://example.com", UriMatchStrategy.Exact], [pairingUri, null]);

          gaFeatureFlag$.next(true);

          expect(cipherFormContainer.patchCipher).toHaveBeenCalledTimes(1);
          expect(getSavedUris()).toEqual([
            { uri: "https://example.com", match: UriMatchStrategy.Exact },
            { uri: pairingUri, match: UriMatchStrategy.Never },
          ]);
        });

        it("does not update the cipher when its desktop app URIs already use the Never match strategy", () => {
          openForm(["https://example.com", null], [pairingUri, UriMatchStrategy.Never]);

          gaFeatureFlag$.next(true);

          expect(cipherFormContainer.patchCipher).not.toHaveBeenCalled();
        });

        it("does not update the cipher when the feature flag is off", () => {
          openForm([pairingUri, null]);

          gaFeatureFlag$.next(false);

          expect(cipherFormContainer.patchCipher).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe("Drag & Drop Functionality", () => {
    beforeEach(() => {
      // Prevent auto‑adding an empty URI by setting a non‑null initial value.
      // This overrides the call to initNewCipher.

      // Now clear any existing URIs (including the auto‑added one)
      component.autofillOptionsForm.controls.uris.clear();

      // Add exactly three URIs that we want to test reordering on.
      component.addUri({ uri: "https://first.com", matchDetection: null });
      component.addUri({ uri: "https://second.com", matchDetection: null });
      component.addUri({ uri: "https://third.com", matchDetection: null });
      fixture.detectChanges();
    });

    it("should reorder URI inputs on drop event", () => {
      // Simulate a drop event that moves the first URI (index 0) to the last position (index 2).
      const dropEvent: CdkDragDrop<HTMLDivElement> = {
        previousIndex: 0,
        currentIndex: 2,
        container: null,
        previousContainer: null,
        isPointerOverContainer: true,
        item: null,
        distance: { x: 0, y: 0 },
      } as any;

      component.onUriItemDrop(dropEvent);
      fixture.detectChanges();

      expect(moveItemInArray).toHaveBeenCalledWith(
        component.autofillOptionsForm.controls.uris.controls,
        0,
        2,
      );
    });

    it("should reorder URI input via keyboard ArrowUp", async () => {
      // Clear and add exactly two URIs.
      component.autofillOptionsForm.controls.uris.clear();
      component.addUri({ uri: "https://first.com", matchDetection: null });
      component.addUri({ uri: "https://second.com", matchDetection: null });
      fixture.detectChanges();

      // Simulate pressing ArrowUp on the second URI (index 1)
      const keyEvent = {
        key: "ArrowUp",
        preventDefault: jest.fn(),
        target: document.createElement("button"),
      } as unknown as KeyboardEvent;

      // Force requestAnimationFrame to run synchronously
      jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
        cb(new Date().getTime());
        return 0;
      });
      (liveAnnouncer.announce as jest.Mock).mockResolvedValue(null);

      await component.onUriItemKeydown(keyEvent, 1);
      fixture.detectChanges();

      expect(moveItemInArray).toHaveBeenCalledWith(
        component.autofillOptionsForm.controls.uris.controls,
        1,
        0,
      );
      expect(liveAnnouncer.announce).toHaveBeenCalledWith(
        "reorderFieldUp websiteUri 1 2",
        "assertive",
      );
    });

    it("should reorder URI input via keyboard ArrowDown", async () => {
      // Clear and add exactly three URIs.
      component.autofillOptionsForm.controls.uris.clear();
      component.addUri({ uri: "https://first.com", matchDetection: null });
      component.addUri({ uri: "https://second.com", matchDetection: null });
      component.addUri({ uri: "https://third.com", matchDetection: null });
      fixture.detectChanges();

      // Simulate pressing ArrowDown on the second URI (index 1)
      const keyEvent = {
        key: "ArrowDown",
        preventDefault: jest.fn(),
        target: document.createElement("button"),
      } as unknown as KeyboardEvent;

      jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
        cb(new Date().getTime());
        return 0;
      });
      (liveAnnouncer.announce as jest.Mock).mockResolvedValue(null);

      await component.onUriItemKeydown(keyEvent, 1);

      expect(moveItemInArray).toHaveBeenCalledWith(
        component.autofillOptionsForm.controls.uris.controls,
        1,
        2,
      );
      expect(liveAnnouncer.announce).toHaveBeenCalledWith(
        "reorderFieldDown websiteUri 3 3",
        "assertive",
      );
    });
  });
});
