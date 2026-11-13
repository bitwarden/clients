import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { DialogService } from "@bitwarden/components";

import { PasswordRepromptService } from "../../../services/password-reprompt.service";
import { CipherFormConfig } from "../../abstractions/cipher-form-config.service";
import { CipherFormContainer } from "../../cipher-form-container";
import { CipherFormHTTPAuthenticationService } from "../../services/cipher-form-http-authentication.service";
import { CustomFieldsComponent } from "../custom-fields/custom-fields.component";

import { AdditionalOptionsSectionComponent } from "./additional-options-section.component";

jest.mock("@bitwarden/common/platform/misc/flags", () => ({
  ...jest.requireActual("@bitwarden/common/platform/misc/flags"),
  devFlagEnabled: jest.fn(),
}));

const mockDevFlagEnabled = devFlagEnabled as jest.Mock;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-custom-fields",
  template: "",
})
class MockCustomFieldsComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disableSectionMargin: boolean;
}

describe("AdditionalOptionsSectionComponent", () => {
  let component: AdditionalOptionsSectionComponent;
  let fixture: ComponentFixture<AdditionalOptionsSectionComponent>;
  let cipherFormProvider: MockProxy<CipherFormContainer>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let passwordRepromptEnabled$: BehaviorSubject<boolean>;
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let httpAuthenticationAvailable$: BehaviorSubject<boolean>;
  let dialogService: MockProxy<DialogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let httpAuthenticationService: CipherFormHTTPAuthenticationService;

  const getInitialCipherView = jest.fn((): any => null);
  const formStatusChange$ = new BehaviorSubject<"enabled" | "disabled">("enabled");

  beforeEach(async () => {
    getInitialCipherView.mockClear();

    cipherFormProvider = mock<CipherFormContainer>({
      getInitialCipherView,
      config: { mode: "edit", cipherType: CipherType.Login } as CipherFormConfig,
    });
    cipherFormProvider.formStatusChange$ = formStatusChange$.asObservable();
    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptEnabled$ = new BehaviorSubject(true);
    passwordRepromptService.enabled$ = passwordRepromptEnabled$;
    httpAuthenticationAvailable$ = new BehaviorSubject(true);
    mockDevFlagEnabled.mockImplementation(
      (flag: string) => flag === "httpAuthenticationCipherControls",
    );
    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    autofillSettingsService.httpAuthenticationAvailable$ = httpAuthenticationAvailable$;
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    platformUtilsService.isSafari.mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [AdditionalOptionsSectionComponent],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormProvider },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: AutofillSettingsServiceAbstraction, useValue: autofillSettingsService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: DialogService, useValue: dialogService },
        CipherFormHTTPAuthenticationService,
      ],
    })
      .overrideComponent(AdditionalOptionsSectionComponent, {
        remove: {
          imports: [CustomFieldsComponent],
        },
        add: {
          imports: [MockCustomFieldsComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AdditionalOptionsSectionComponent);
    component = fixture.componentInstance;
    httpAuthenticationService = fixture.debugElement.injector.get(
      CipherFormHTTPAuthenticationService,
    );
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("registers 'additionalOptionsForm' form with CipherFormContainer", () => {
    expect(cipherFormProvider.registerChildForm).toHaveBeenCalledWith(
      "additionalOptions",
      component.additionalOptionsForm,
    );
  });

  it("patches 'additionalOptionsForm' changes to CipherFormContainer", () => {
    component.additionalOptionsForm.patchValue({
      notes: "new notes",
      reprompt: true,
    });

    const expectedCipher = new CipherView();
    expectedCipher.notes = "new notes";
    expectedCipher.reprompt = CipherRepromptType.Password;
    expectedCipher.login.httpAuthenticationEnabled = false;

    expect(cipherFormProvider.patchCipher).toHaveBeenCalled();
    const patchFn = cipherFormProvider.patchCipher.mock.lastCall[0];

    const newCipher = new CipherView();
    newCipher.creationDate = newCipher.revisionDate = expectedCipher.creationDate;

    const updated = patchFn(newCipher);

    expect(updated).toEqual(expectedCipher);
  });

  it("disables 'additionalOptionsForm' when in partial-edit mode", () => {
    cipherFormProvider.config.mode = "partial-edit";

    component.ngOnInit();

    expect(component.additionalOptionsForm.disabled).toBe(true);
  });

  it("initializes 'additionalOptionsForm' from `getInitialCipherValue`", () => {
    getInitialCipherView.mockReturnValueOnce({
      notes: "original notes",
      reprompt: 1,
    } as CipherView);

    component.ngOnInit();

    expect(component.additionalOptionsForm.value).toEqual({
      notes: "original notes",
      reprompt: true,
      httpAuthentication: false,
    });
  });

  it("hides password reprompt checkbox when disabled", () => {
    passwordRepromptEnabled$.next(true);
    fixture.detectChanges();

    let checkbox = fixture.nativeElement.querySelector("input[formControlName='reprompt']");
    expect(checkbox).not.toBeNull();

    passwordRepromptEnabled$.next(false);
    fixture.detectChanges();

    checkbox = fixture.nativeElement.querySelector("input[formControlName='reprompt']");
    expect(checkbox).toBeNull();
  });

  describe("HTTP authentication", () => {
    const getHTTPAuthenticationCheckbox = (): HTMLInputElement | null =>
      fixture.nativeElement.querySelector("input[formControlName='httpAuthentication']");

    const flushPromises = () => fixture.whenStable();

    it("shows the HTTP authentication setting for login items when HTTP authentication is available and the dev flag is on", () => {
      fixture.detectChanges();

      expect(getHTTPAuthenticationCheckbox()).not.toBeNull();
    });

    it("hides the HTTP authentication setting when HTTP authentication is unavailable", () => {
      httpAuthenticationAvailable$.next(false);
      fixture.detectChanges();

      expect(getHTTPAuthenticationCheckbox()).toBeNull();
    });

    it("hides the HTTP authentication setting when the cipher controls dev flag is off", () => {
      mockDevFlagEnabled.mockReturnValue(false);
      const localFixture = TestBed.createComponent(AdditionalOptionsSectionComponent);
      localFixture.detectChanges();

      expect(mockDevFlagEnabled).toHaveBeenCalledWith("httpAuthenticationCipherControls");
      expect(
        localFixture.nativeElement.querySelector("input[formControlName='httpAuthentication']"),
      ).toBeNull();
    });

    it("hides the HTTP authentication setting for items other than logins", () => {
      cipherFormProvider.config.cipherType = CipherType.Card;
      const localFixture = TestBed.createComponent(AdditionalOptionsSectionComponent);
      localFixture.detectChanges();

      expect(
        localFixture.nativeElement.querySelector("input[formControlName='httpAuthentication']"),
      ).toBeNull();
    });

    it("shows the HTTP authentication setting in the Safari extension", () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
      platformUtilsService.isSafari.mockReturnValue(true);
      const localFixture = TestBed.createComponent(AdditionalOptionsSectionComponent);
      localFixture.detectChanges();

      expect(
        localFixture.nativeElement.querySelector("input[formControlName='httpAuthentication']"),
      ).not.toBeNull();
    });

    it("shows the HTTP authentication setting in the web vault opened in Safari", () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Web);
      platformUtilsService.isSafari.mockReturnValue(true);
      const localFixture = TestBed.createComponent(AdditionalOptionsSectionComponent);
      localFixture.detectChanges();

      expect(
        localFixture.nativeElement.querySelector("input[formControlName='httpAuthentication']"),
      ).not.toBeNull();
    });

    it("opens the HTTP authentication help article from the setting description", () => {
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
        "#additional-options_link_http-authentication-help",
      );
      link.click();

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://bitwarden.com/help/basic-auth-autofill/",
      );
    });

    describe("saving", () => {
      const createCipher = (type: CipherType) => {
        const cipher = new CipherView();
        cipher.type = type;
        cipher.login = new LoginView();
        return cipher;
      };

      it.each([true, false])("patches the setting (%s) onto the login", (enabled) => {
        component.additionalOptionsForm.controls.httpAuthentication.setValue(enabled);

        const patchFn = cipherFormProvider.patchCipher.mock.lastCall[0];
        const updated = patchFn(createCipher(CipherType.Login));

        expect(updated.login.httpAuthenticationEnabled).toBe(enabled);
      });

      it("patches the setting while the control is disabled", () => {
        const { httpAuthentication, notes } = component.additionalOptionsForm.controls;
        httpAuthentication.setValue(true);
        httpAuthentication.disable({ emitEvent: false });
        notes.setValue("new notes");

        const patchFn = cipherFormProvider.patchCipher.mock.lastCall[0];
        const updated = patchFn(createCipher(CipherType.Login));

        expect(updated.login.httpAuthenticationEnabled).toBe(true);
      });

      it("does not patch the setting onto items other than logins", () => {
        component.additionalOptionsForm.controls.httpAuthentication.setValue(true);

        const patchFn = cipherFormProvider.patchCipher.mock.lastCall[0];
        const updated = patchFn(createCipher(CipherType.Card));

        expect(updated.login.httpAuthenticationEnabled).toBeUndefined();
      });
    });

    describe("loading", () => {
      const loadCipher = (httpAuthenticationEnabled: boolean | undefined, reprompt: boolean) => {
        const cipher = new CipherView();
        cipher.type = CipherType.Login;
        cipher.reprompt = reprompt ? CipherRepromptType.Password : CipherRepromptType.None;
        cipher.login = new LoginView();
        cipher.login.httpAuthenticationEnabled = httpAuthenticationEnabled;
        getInitialCipherView.mockReturnValueOnce(cipher);

        component.ngOnInit();
      };

      it.each([
        { stored: true, expected: true },
        { stored: false, expected: false },
        { stored: undefined, expected: false },
      ])("loads a stored setting of $stored as $expected", ({ stored, expected }) => {
        loadCipher(stored, false);

        expect(component.additionalOptionsForm.controls.httpAuthentication.value).toBe(expected);
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      });

      it("loads HTTP authentication off and tells the user when reprompt is also on", async () => {
        loadCipher(true, true);
        await flushPromises();

        const { httpAuthentication, reprompt } = component.additionalOptionsForm.controls;
        expect(reprompt.value).toBe(true);
        expect(httpAuthentication.value).toBe(false);
        expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({ title: { key: "httpAuthenticationTurnedOffTitle" } }),
        );
      });

      it("turns HTTP authentication off without telling the user when the setting is hidden", async () => {
        httpAuthenticationAvailable$.next(false);

        loadCipher(true, true);
        await flushPromises();

        expect(component.additionalOptionsForm.controls.httpAuthentication.value).toBe(false);
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      });
    });

    describe("reprompt exclusivity", () => {
      it("does not ask to confirm turning on HTTP authentication when reprompt is off", () => {
        component.additionalOptionsForm.controls.httpAuthentication.setValue(true);

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      });

      it("turns reprompt off when the user confirms turning on HTTP authentication", async () => {
        const { reprompt, httpAuthentication } = component.additionalOptionsForm.controls;
        reprompt.setValue(true);

        httpAuthentication.setValue(true);
        await flushPromises();

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({ title: { key: "turnOnHttpAuthenticationTitle" } }),
        );
        expect(reprompt.value).toBe(false);
        expect(httpAuthentication.value).toBe(true);
      });

      it("keeps HTTP authentication off when the user declines turning it on", async () => {
        dialogService.openSimpleDialog.mockResolvedValue(false);
        const { reprompt, httpAuthentication } = component.additionalOptionsForm.controls;
        reprompt.setValue(true);

        httpAuthentication.setValue(true);
        await flushPromises();

        expect(reprompt.value).toBe(true);
        expect(httpAuthentication.value).toBe(false);
      });

      it("turns HTTP authentication off when the user confirms turning on reprompt", async () => {
        const { reprompt, httpAuthentication } = component.additionalOptionsForm.controls;
        httpAuthentication.setValue(true);

        reprompt.setValue(true);
        await flushPromises();

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({ title: { key: "turnOnPasswordRepromptTitle" } }),
        );
        expect(reprompt.value).toBe(true);
        expect(httpAuthentication.value).toBe(false);
      });

      it("keeps reprompt off when the user declines turning it on", async () => {
        dialogService.openSimpleDialog.mockResolvedValue(false);
        const { reprompt, httpAuthentication } = component.additionalOptionsForm.controls;
        httpAuthentication.setValue(true);

        reprompt.setValue(true);
        await flushPromises();

        expect(reprompt.value).toBe(false);
        expect(httpAuthentication.value).toBe(true);
      });
    });

    describe("match strategy requirement", () => {
      it("disables HTTP authentication and shows a note when a URI uses the default match strategy", () => {
        httpAuthenticationService.updateUriMatchStrategies([UriMatchStrategy.Host, null]);
        fixture.detectChanges();

        expect(component.additionalOptionsForm.controls.httpAuthentication.disabled).toBe(true);
        expect(component["httpAuthenticationBlockedByMatchStrategy"]()).toBe(true);
      });

      it("enables HTTP authentication when every URI has an explicit match strategy", () => {
        httpAuthenticationService.updateUriMatchStrategies([null]);
        httpAuthenticationService.updateUriMatchStrategies([
          UriMatchStrategy.Host,
          UriMatchStrategy.RegularExpression,
        ]);
        fixture.detectChanges();

        expect(component.additionalOptionsForm.controls.httpAuthentication.enabled).toBe(true);
        expect(component["httpAuthenticationBlockedByMatchStrategy"]()).toBe(false);
      });

      it("enables HTTP authentication when there are no URIs", () => {
        httpAuthenticationService.updateUriMatchStrategies([]);

        expect(component.additionalOptionsForm.controls.httpAuthentication.enabled).toBe(true);
      });

      it("keeps HTTP authentication disabled when the form is re-enabled while a URI uses the default", () => {
        httpAuthenticationService.updateUriMatchStrategies([null]);

        formStatusChange$.next("disabled");
        formStatusChange$.next("enabled");

        expect(component.additionalOptionsForm.controls.httpAuthentication.disabled).toBe(true);
      });

      it("keeps HTTP authentication disabled in partial-edit mode", () => {
        cipherFormProvider.config.mode = "partial-edit";

        httpAuthenticationService.updateUriMatchStrategies([UriMatchStrategy.Host]);
        formStatusChange$.next("enabled");

        expect(component.additionalOptionsForm.controls.httpAuthentication.disabled).toBe(true);
      });
    });
  });
});
