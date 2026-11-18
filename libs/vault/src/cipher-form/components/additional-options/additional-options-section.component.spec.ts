import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, Observable, Subject } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { DialogRef, DialogService } from "@bitwarden/components";

import { PasswordRepromptService } from "../../../services/password-reprompt.service";
import { CipherFormConfig } from "../../abstractions/cipher-form-config.service";
import { CipherFormContainer } from "../../cipher-form-container";
import { CustomFieldsComponent } from "../custom-fields/custom-fields.component";

import { AdditionalOptionsSectionComponent } from "./additional-options-section.component";
import { HTTPAuthenticationWarningDialogComponent } from "./http-authentication-warning-dialog.component";

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

  const getInitialCipherView = jest.fn((): any => null);

  beforeEach(async () => {
    getInitialCipherView.mockClear();

    cipherFormProvider = mock<CipherFormContainer>({
      getInitialCipherView,
      config: { mode: "edit", cipherType: CipherType.Login } as CipherFormConfig,
    });
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

  it("styles the add field button as a link", () => {
    fixture.detectChanges();

    const addFieldButton: HTMLButtonElement =
      fixture.nativeElement.querySelector("button[bitLink]");

    expect(addFieldButton.className).toContain("tw-text-fg-brand");
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

    it.each([
      ["the Safari extension", ClientType.Browser, true],
      ["the web vault", ClientType.Web, false],
      ["the web vault opened in Safari", ClientType.Web, true],
      ["the desktop app", ClientType.Desktop, false],
      ["the CLI", ClientType.Cli, false],
    ])("hides the HTTP authentication setting in %s", (_, clientType, isSafari) => {
      platformUtilsService.getClientType.mockReturnValue(clientType);
      platformUtilsService.isSafari.mockReturnValue(isSafari);
      const localFixture = TestBed.createComponent(AdditionalOptionsSectionComponent);
      localFixture.detectChanges();

      expect(
        localFixture.nativeElement.querySelector("input[formControlName='httpAuthentication']"),
      ).toBeNull();
    });

    it("shows no hint under the setting", () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-hint")).toBeNull();
    });

    describe("turning the setting on", () => {
      const clickHTTPAuthenticationCheckbox = async () => {
        fixture.detectChanges();
        getHTTPAuthenticationCheckbox()!.click();
        await flushPromises();
      };

      let openWarningDialog: jest.SpyInstance;

      const warningDialogRef = (closed: Observable<boolean | undefined>) =>
        ({ closed }) as DialogRef<boolean>;

      /** Clicks the unchecked checkbox, then answers the warning as the user would, after the click. */
      const clickAndRespondToWarning = async (result: boolean | undefined) => {
        const closed$ = new Subject<boolean | undefined>();
        openWarningDialog.mockReturnValueOnce(warningDialogRef(closed$.asObservable()));

        await clickHTTPAuthenticationCheckbox();
        closed$.next(result);
        closed$.complete();
        await flushPromises();
      };

      beforeEach(() => {
        // A warning the user hasn't answered yet, so no test renders the real dialog.
        openWarningDialog = jest
          .spyOn(HTTPAuthenticationWarningDialogComponent, "open")
          .mockReturnValue(warningDialogRef(NEVER));
      });

      afterEach(() => {
        openWarningDialog.mockRestore();
      });

      it("shows the warning and leaves the setting off until the user responds", async () => {
        await clickHTTPAuthenticationCheckbox();

        expect(openWarningDialog).toHaveBeenCalledTimes(1);
        expect(component.additionalOptionsForm.controls.httpAuthentication.value).toBe(false);
        expect(getHTTPAuthenticationCheckbox()!.checked).toBe(false);
      });

      it("turns the setting on when the user confirms", async () => {
        await clickAndRespondToWarning(true);

        const { httpAuthentication } = component.additionalOptionsForm.controls;
        expect(httpAuthentication.value).toBe(true);
        expect(httpAuthentication.dirty).toBe(true);
        expect(getHTTPAuthenticationCheckbox()!.checked).toBe(true);
      });

      it.each([
        ["cancels", false],
        ["dismisses the warning", undefined],
      ])("leaves the setting off when the user %s", async (_, result) => {
        await clickAndRespondToWarning(result);

        expect(component.additionalOptionsForm.controls.httpAuthentication.value).toBe(false);
        expect(getHTTPAuthenticationCheckbox()!.checked).toBe(false);
      });

      it("shows the warning every time the setting is turned on", async () => {
        await clickAndRespondToWarning(true);
        await clickHTTPAuthenticationCheckbox();
        await clickAndRespondToWarning(true);

        expect(openWarningDialog).toHaveBeenCalledTimes(2);
        expect(component.additionalOptionsForm.controls.httpAuthentication.value).toBe(true);
      });

      it("turns the setting off without a warning", async () => {
        component.additionalOptionsForm.controls.httpAuthentication.setValue(true);

        await clickHTTPAuthenticationCheckbox();

        expect(openWarningDialog).not.toHaveBeenCalled();
        expect(component.additionalOptionsForm.controls.httpAuthentication.value).toBe(false);
      });

      it("does not show the warning when a stored setting is loaded", () => {
        getInitialCipherView.mockReturnValueOnce({
          reprompt: CipherRepromptType.None,
          login: { httpAuthenticationEnabled: true },
        } as CipherView);

        component.ngOnInit();

        expect(openWarningDialog).not.toHaveBeenCalled();
        expect(component.additionalOptionsForm.controls.httpAuthentication.value).toBe(true);
      });
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

      it("loads both settings when HTTP authentication and reprompt are both on", () => {
        loadCipher(true, true);

        const { httpAuthentication, reprompt } = component.additionalOptionsForm.controls;
        expect(reprompt.value).toBe(true);
        expect(httpAuthentication.value).toBe(true);
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      });
    });

    describe("with master password reprompt and match detection", () => {
      it("keeps reprompt on when HTTP authentication is turned on", () => {
        const { httpAuthentication, reprompt } = component.additionalOptionsForm.controls;
        reprompt.setValue(true);

        httpAuthentication.setValue(true);

        expect(reprompt.value).toBe(true);
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      });

      it("keeps HTTP authentication on when reprompt is turned on", () => {
        const { httpAuthentication, reprompt } = component.additionalOptionsForm.controls;
        httpAuthentication.setValue(true);

        reprompt.setValue(true);

        expect(httpAuthentication.value).toBe(true);
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      });

      it("keeps the setting enabled whatever the match detection", () => {
        fixture.detectChanges();

        expect(component.additionalOptionsForm.controls.httpAuthentication.enabled).toBe(true);
      });

      it("disables the setting in partial-edit mode", () => {
        cipherFormProvider.config.mode = "partial-edit";

        component.ngOnInit();

        expect(component.additionalOptionsForm.controls.httpAuthentication.disabled).toBe(true);
      });
    });
  });
});
