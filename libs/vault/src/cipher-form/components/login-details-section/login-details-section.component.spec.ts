import { DatePipe } from "@angular/common";
import { Component } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, delay, of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PremiumUpgradeNudgeService } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  BitPasswordInputToggleDirective,
  CenterPositionStrategy,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { CipherFormGenerationService } from "../../abstractions/cipher-form-generation.service";
import { TotpCaptureService } from "../../abstractions/totp-capture.service";
import { CipherFormContainer } from "../../cipher-form-container";
import { AutofillOptionsComponent } from "../autofill-options/autofill-options.component";

import {
  DeletePasskeyDialogComponent,
  DeletePasskeyDialogResult,
} from "./delete-passkey-dialog/delete-passkey-dialog.component";
import { LoginDetailsSectionComponent } from "./login-details-section.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-autofill-options",
  template: "",
})
class MockAutoFillOptionsComponent {}

describe("LoginDetailsSectionComponent", () => {
  let component: LoginDetailsSectionComponent;
  let fixture: ComponentFixture<LoginDetailsSectionComponent>;

  let cipherFormContainer: MockProxy<CipherFormContainer>;
  let generationService: MockProxy<CipherFormGenerationService>;
  let auditService: MockProxy<AuditService>;
  let toastService: MockProxy<ToastService>;
  let totpCaptureService: MockProxy<TotpCaptureService>;
  let i18nService: MockProxy<I18nService>;
  let configService: MockProxy<ConfigService>;
  let dialogService: MockProxy<DialogService>;
  let nudgesService: MockProxy<NudgesService>;
  let premiumUpgradeNudgeService: MockProxy<PremiumUpgradeNudgeService>;
  let upgradePathsFlag$: BehaviorSubject<boolean>;
  let hasPremium$: BehaviorSubject<boolean>;
  let showTotpNudge$: BehaviorSubject<boolean>;
  let organizationId$: BehaviorSubject<string | null>;
  let totpService: MockProxy<TotpService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;

  const userId = "user-id" as UserId;
  const collect = jest.fn().mockResolvedValue(null);
  const getInitialCipherView = jest.fn((): any => null);

  beforeEach(async () => {
    getInitialCipherView.mockClear();
    organizationId$ = new BehaviorSubject<string | null>(null);
    cipherFormContainer = mock<CipherFormContainer>({
      getInitialCipherView,
      formStatusChange$: new BehaviorSubject<"enabled" | "disabled">("enabled"),
      website: "example.com",
    });
    cipherFormContainer.organizationId$ = organizationId$;

    generationService = mock<CipherFormGenerationService>();
    auditService = mock<AuditService>();
    toastService = mock<ToastService>();
    totpCaptureService = mock<TotpCaptureService>();
    i18nService = mock<I18nService>();
    upgradePathsFlag$ = new BehaviorSubject<boolean>(false);
    hasPremium$ = new BehaviorSubject<boolean>(false);
    showTotpNudge$ = new BehaviorSubject<boolean>(true);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
      flag === FeatureFlag.PM42214_FeatureBasedUpgradePaths ? upgradePathsFlag$ : of(false),
    );
    dialogService = mock<DialogService>();
    nudgesService = mock<NudgesService>();
    nudgesService.showNudgeSpotlight$.mockReturnValue(showTotpNudge$);
    premiumUpgradeNudgeService = mock<PremiumUpgradeNudgeService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(hasPremium$);
    totpService = mock<TotpService>();
    totpService.getCode$.mockReturnValue(of({ code: "123456", period: 30 }).pipe(delay(0)));
    collect.mockClear();

    await TestBed.configureTestingModule({
      imports: [LoginDetailsSectionComponent],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormContainer },
        { provide: CipherFormGenerationService, useValue: generationService },
        { provide: AuditService, useValue: auditService },
        { provide: ToastService, useValue: toastService },
        { provide: TotpCaptureService, useValue: totpCaptureService },
        { provide: I18nService, useValue: i18nService },
        { provide: ConfigService, useValue: configService },
        { provide: EventCollectionService, useValue: { collect } },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: NudgesService, useValue: nudgesService },
        { provide: PremiumUpgradeNudgeService, useValue: premiumUpgradeNudgeService },
        { provide: TotpService, useValue: totpService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    })
      .overrideProvider(DialogService, { useValue: dialogService })
      .overrideComponent(LoginDetailsSectionComponent, {
        remove: {
          imports: [AutofillOptionsComponent],
        },
        add: {
          imports: [MockAutoFillOptionsComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(LoginDetailsSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("registers 'loginDetailsForm' form with CipherFormContainer", () => {
    expect(cipherFormContainer.registerChildForm).toHaveBeenCalledWith(
      "loginDetails",
      component.loginDetailsForm,
    );
  });

  it("patches 'loginDetailsForm' changes to CipherFormContainer", () => {
    component.loginDetailsForm.patchValue({
      username: "new-username",
      password: "secret-password",
      totp: "123456",
    });

    expect(cipherFormContainer.patchCipher).toHaveBeenCalled();
    const patchFn = cipherFormContainer.patchCipher.mock.lastCall[0];

    const updatedCipher = patchFn(new CipherView());

    expect(updatedCipher.login.username).toBe("new-username");
    expect(updatedCipher.login.password).toBe("secret-password");
    expect(updatedCipher.login.totp).toBe("123456");
  });

  it("disables 'loginDetailsForm' when in partial-edit mode", async () => {
    cipherFormContainer.config.mode = "partial-edit";

    await component.ngOnInit();

    expect(component.loginDetailsForm.disabled).toBe(true);
  });

  it("initializes 'loginDetailsForm' with original cipher view values", async () => {
    getInitialCipherView.mockReturnValueOnce({
      viewPassword: true,
      login: {
        password: "original-password",
        username: "original-username",
        totp: "original-totp",
      },
    });

    component.ngOnInit();

    expect(component.loginDetailsForm.getRawValue()).toEqual({
      username: "original-username",
      password: "original-password",
      totp: "original-totp",
    });
  });

  it("initializes 'loginDetailsForm' with initialValues that override any original cipher view values", async () => {
    getInitialCipherView.mockReturnValueOnce({
      viewPassword: true,
      login: {
        password: "original-password",
        username: "original-username",
        totp: "original-totp",
      },
    });

    cipherFormContainer.config.initialValues = {
      username: "new-username",
      password: "new-password",
    };

    component.ngOnInit();

    expect(component.loginDetailsForm.getRawValue()).toEqual({
      username: "new-username",
      password: "new-password",
      totp: "original-totp",
    });
  });

  describe("viewHiddenFields", () => {
    beforeEach(() => {
      getInitialCipherView.mockReturnValue({
        viewPassword: false,
        login: {
          password: "original-password",
        },
      });
    });

    it("returns value of originalCipher.viewPassword", () => {
      (cipherFormContainer.originalCipherView as CipherView).viewPassword = true;

      expect(component.viewHiddenFields).toBe(true);

      (cipherFormContainer.originalCipherView as CipherView).viewPassword = false;

      expect(component.viewHiddenFields).toBe(false);
    });

    it("returns true when creating a new cipher", () => {
      (cipherFormContainer.originalCipherView as CipherView) = null;

      expect(component.viewHiddenFields).toBe(true);
    });

    it("disables the password and totp fields when passwords are hidden for the original cipher", async () => {
      await component.ngOnInit();

      expect(component.loginDetailsForm.controls.password.disabled).toBe(true);
      expect(component.loginDetailsForm.controls.totp.disabled).toBe(true);
    });

    it("still provides original values for hidden fields when passwords are hidden", async () => {
      await component.ngOnInit();

      component.loginDetailsForm.patchValue({
        username: "new-username",
      });

      expect(cipherFormContainer.patchCipher).toHaveBeenCalled();
      const patchFn = cipherFormContainer.patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.login.username).toBe("new-username");
      expect(updatedCipher.login.password).toBe("original-password");
    });
  });

  describe("username", () => {
    const getGenerateUsernameBtn = () =>
      fixture.nativeElement.querySelector("button[data-testid='generate-username-button']");

    it("should show generate username button when editable", () => {
      expect(getGenerateUsernameBtn()).not.toBeNull();
    });

    it("should hide generate username button when not editable", fakeAsync(() => {
      component.loginDetailsForm.controls.username.disable();
      fixture.detectChanges();
      expect(getGenerateUsernameBtn()).toBeNull();
    }));

    it("should generate a username when the generate username button is clicked", fakeAsync(() => {
      generationService.generateUsername.mockResolvedValue("generated-username");

      getGenerateUsernameBtn().click();

      tick();

      expect(component.loginDetailsForm.controls.username.value).toEqual("generated-username");
    }));

    it("should not replace an existing username if generation returns null", fakeAsync(() => {
      generationService.generateUsername.mockResolvedValue(null);

      getGenerateUsernameBtn().click();

      tick();

      const usernameSpy = jest.spyOn(component.loginDetailsForm.controls.username, "patchValue");

      expect(usernameSpy).not.toHaveBeenCalled();
    }));
  });

  describe("password", () => {
    beforeEach(() => {
      getInitialCipherView.mockReturnValue(null);
    });

    const getGeneratePasswordBtn = () =>
      fixture.nativeElement.querySelector("button[data-testid='generate-password-button']");

    const getCheckPasswordBtn = () =>
      fixture.nativeElement.querySelector("button[data-testid='check-password-button']");

    const getTogglePasswordVisibilityBtn = () =>
      fixture.nativeElement.querySelector("button[data-testid='toggle-password-visibility']");

    it("should show the password visibility toggle button based on viewHiddenFields", () => {
      jest.spyOn(component, "viewHiddenFields", "get").mockReturnValue(true);
      fixture.detectChanges();
      expect(getTogglePasswordVisibilityBtn()).not.toBeNull();

      jest.spyOn(component, "viewHiddenFields", "get").mockReturnValue(false);
      fixture.detectChanges();
      expect(getTogglePasswordVisibilityBtn()).toBeNull();
    });

    it("logs password viewed event when toggledChange is true", async () => {
      cipherFormContainer.config.mode = "edit";
      cipherFormContainer.config.originalCipher = {
        id: "111-222-333",
        organizationId: "333-444-555",
      } as Cipher;
      jest.spyOn(component, "viewHiddenFields", "get").mockReturnValue(true);
      fixture.detectChanges();

      const passwordToggle = fixture.debugElement.query(
        By.directive(BitPasswordInputToggleDirective),
      );
      await passwordToggle.triggerEventHandler("toggledChange", true);

      expect(collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientToggledPasswordVisible,
        "111-222-333",
        false,
        "333-444-555",
      );

      await passwordToggle.triggerEventHandler("toggledChange", false);

      expect(collect).toHaveBeenCalledTimes(1);
    });

    describe("password generation", () => {
      it("should show generate password button when editable", () => {
        expect(getGeneratePasswordBtn()).not.toBeNull();
      });

      it("should hide generate password button when not editable", fakeAsync(() => {
        component.loginDetailsForm.controls.password.disable();
        fixture.detectChanges();

        expect(getGeneratePasswordBtn()).toBeNull();
      }));

      it("should generate a password when the generate password button is clicked", fakeAsync(() => {
        generationService.generatePassword.mockResolvedValue("generated-password");

        getGeneratePasswordBtn().click();

        tick();

        expect(component.loginDetailsForm.controls.password.value).toEqual("generated-password");
      }));

      it("should not replace an existing password if generation returns null", fakeAsync(() => {
        generationService.generatePassword.mockResolvedValue(null);

        getGeneratePasswordBtn().click();

        tick();

        const passwordSpy = jest.spyOn(component.loginDetailsForm.controls.password, "patchValue");

        expect(passwordSpy).not.toHaveBeenCalled();
      }));
    });

    describe("password checking", () => {
      it("should show the password check button when a password is present and editable", () => {
        component.loginDetailsForm.controls.password.setValue("password");
        fixture.detectChanges();
        expect(getCheckPasswordBtn()).not.toBeNull();
      });

      it("should hide the password check button when the password is missing", () => {
        component.loginDetailsForm.controls.password.setValue(null);
        fixture.detectChanges();
        expect(getCheckPasswordBtn()).toBeNull();
      });

      it("should hide the password check button when the password is not editable", () => {
        component.loginDetailsForm.controls.password.disable();
        fixture.detectChanges();
        expect(getCheckPasswordBtn()).toBeNull();
      });

      it("should call checkPassword when the password check button is clicked", fakeAsync(() => {
        component.checkPassword = jest.fn();
        component.loginDetailsForm.controls.password.setValue("password");

        fixture.detectChanges();

        getCheckPasswordBtn().click();

        tick();

        expect(component.checkPassword).toHaveBeenCalled();
      }));

      describe("checkPassword", () => {
        it("should not call the audit service when the password is empty", async () => {
          component.loginDetailsForm.controls.password.setValue(null);

          await component.checkPassword();

          expect(auditService.passwordLeaked).not.toHaveBeenCalled();
          expect(toastService.showToast).not.toHaveBeenCalled();
        });

        it("should show a warning toast when the password has been exposed in a data breach", async () => {
          component.loginDetailsForm.controls.password.setValue("password");
          auditService.passwordLeaked.mockResolvedValue(1);
          i18nService.t.mockReturnValue("passwordExposedMsg");

          await component.checkPassword();

          expect(auditService.passwordLeaked).toHaveBeenCalledWith("password");
          expect(toastService.showToast).toHaveBeenCalledWith({
            variant: "warning",
            title: null,
            message: "passwordExposedMsg",
          });
          expect(i18nService.t).toHaveBeenCalledWith("passwordExposed", "1");
        });

        it("should show a success toast when the password has not been exposed in a data breach", async () => {
          component.loginDetailsForm.controls.password.setValue("password");
          auditService.passwordLeaked.mockResolvedValue(0);
          i18nService.t.mockReturnValue("passwordSafeMsg");

          await component.checkPassword();

          expect(auditService.passwordLeaked).toHaveBeenCalledWith("password");
          expect(toastService.showToast).toHaveBeenCalledWith({
            variant: "success",
            title: null,
            message: "passwordSafeMsg",
          });
          expect(i18nService.t).toHaveBeenCalledWith("passwordSafe");
        });
      });
    });
  });

  describe("totp", () => {
    const getToggleTotpVisibilityBtn = () =>
      fixture.nativeElement.querySelector("button[data-testid='toggle-totp-visibility']");

    const getCaptureTotpBtn = () =>
      fixture.nativeElement.querySelector("button[data-testid='capture-totp-button']");

    it("should show the totp visibility toggle button based on viewHiddenFields", () => {
      jest.spyOn(component, "viewHiddenFields", "get").mockReturnValue(true);
      fixture.detectChanges();
      expect(getToggleTotpVisibilityBtn()).not.toBeNull();

      jest.spyOn(component, "viewHiddenFields", "get").mockReturnValue(false);
      fixture.detectChanges();
      expect(getToggleTotpVisibilityBtn()).toBeNull();
    });

    it("should show the totp capture button based on canCaptureTotp", () => {
      jest.spyOn(component, "canCaptureTotp", "get").mockReturnValue(true);
      fixture.detectChanges();
      expect(getCaptureTotpBtn()).not.toBeNull();

      jest.spyOn(component, "canCaptureTotp", "get").mockReturnValue(false);
      fixture.detectChanges();
      expect(getCaptureTotpBtn()).toBeNull();
    });

    it("should call captureTotp when the capture totp button is clicked", fakeAsync(() => {
      jest.spyOn(component, "canCaptureTotp", "get").mockReturnValue(true);
      component.captureTotp = jest.fn();
      fixture.detectChanges();

      getCaptureTotpBtn().click();

      tick();

      expect(component.captureTotp).toHaveBeenCalled();
    }));

    describe("canCaptureTotp", () => {
      it("should return true when totpCaptureService is present and totpCaptureService.canCaptureTotp is true and totp is editable", () => {
        jest.spyOn(component, "canCaptureTotp", "get").mockReturnValue(true);
        component.loginDetailsForm.controls.totp.enable();
        expect(component.canCaptureTotp).toBe(true);
      });

      it("should return false when totpCaptureService is missing", () => {
        (component as any).totpCaptureService = null;
        expect(component.canCaptureTotp).toBe(false);
      });

      it("should return false when totp is disabled", () => {
        component.loginDetailsForm.controls.totp.disable();
        expect(component.canCaptureTotp).toBe(false);
      });
    });

    describe("captureTotp", () => {
      it("should not call totpCaptureService.captureTotpSecret when canCaptureTotp is false", async () => {
        jest.spyOn(component, "canCaptureTotp", "get").mockReturnValue(false);
        await component.captureTotp();
        expect(totpCaptureService.captureTotpSecret).not.toHaveBeenCalled();
      });

      it("should patch the totp value when totpCaptureService.captureTotpSecret returns a value", async () => {
        jest.spyOn(component, "canCaptureTotp", "get").mockReturnValue(true);
        totpCaptureService.captureTotpSecret.mockResolvedValue("some-totp-secret");
        i18nService.t.mockReturnValue("totpCaptureSuccessMsg");

        await component.captureTotp();

        expect(component.loginDetailsForm.controls.totp.value).toBe("some-totp-secret");
        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: null,
          message: "totpCaptureSuccessMsg",
        });
      });

      it("should show an error toast when totpCaptureService.captureTotpSecret throws", async () => {
        jest.spyOn(component, "canCaptureTotp", "get").mockReturnValue(true);
        totpCaptureService.captureTotpSecret.mockRejectedValue(new Error());
        i18nService.t.mockReturnValueOnce("errorOccurredMsg");
        i18nService.t.mockReturnValueOnce("totpCaptureErrorMsg");

        const totpSpy = jest.spyOn(component.loginDetailsForm.controls.totp, "patchValue");

        await component.captureTotp();

        expect(totpSpy).not.toHaveBeenCalled();
        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: "errorOccurredMsg",
          message: "totpCaptureErrorMsg",
        });
      });
    });
  });

  describe("passkeys", () => {
    const passkeyDate = new Date();
    const dateSpy = jest
      .spyOn(DatePipe.prototype, "transform")
      .mockReturnValue(passkeyDate.toString());

    const getRemovePasskeyBtn = () =>
      fixture.nativeElement.querySelector("button[data-testid='remove-passkey-button']");

    const getPasskeyField = () =>
      fixture.nativeElement.querySelector("input[data-testid='passkey-field']");

    beforeEach(() => {
      getInitialCipherView.mockReturnValue({
        login: Object.assign(new LoginView(), {
          fido2Credentials: [{ creationDate: passkeyDate } as Fido2CredentialView],
        }),
      });

      fixture = TestBed.createComponent(LoginDetailsSectionComponent);
      component = fixture.componentInstance;

      jest.spyOn(component, "viewHiddenFields", "get").mockReturnValue(true);
    });

    it("renders the passkey field when available", () => {
      i18nService.t.mockReturnValue("Created");

      fixture.detectChanges();

      const passkeyField = getPasskeyField();

      expect(passkeyField).not.toBeNull();
      expect(dateSpy).toHaveBeenLastCalledWith(passkeyDate, "short");
      expect(passkeyField.value).toBe("Created " + passkeyDate.toString());
    });

    it("renders the passkey remove button when editable", () => {
      fixture.detectChanges();

      expect(getRemovePasskeyBtn()).not.toBeNull();
    });

    it("does not render the passkey remove button when not editable", () => {
      cipherFormContainer.config.mode = "partial-edit";

      fixture.detectChanges();

      expect(getRemovePasskeyBtn()).toBeNull();
    });

    it("does not render the passkey remove button when viewHiddenFields is false", () => {
      jest.spyOn(component, "viewHiddenFields", "get").mockReturnValue(false);

      fixture.detectChanges();

      expect(getRemovePasskeyBtn()).toBeNull();
    });

    it("hides the passkey field when missing a passkey", () => {
      getInitialCipherView.mockReturnValueOnce({
        login: Object.assign(new LoginView(), {
          fido2Credentials: [],
        }),
      });

      fixture.detectChanges();

      expect(getPasskeyField()).toBeNull();
    });

    it("should remove the passkey when the user confirms the dialog", fakeAsync(() => {
      dialogService.open.mockReturnValue({
        closed: of(DeletePasskeyDialogResult.Delete),
      } as DialogRef<DeletePasskeyDialogResult>);
      fixture.detectChanges();

      getRemovePasskeyBtn().click();

      tick();

      expect(dialogService.open).toHaveBeenCalledWith(DeletePasskeyDialogComponent, {
        positionStrategy: expect.any(CenterPositionStrategy),
      });
      expect(cipherFormContainer.patchCipher).toHaveBeenCalled();
      const patchFn = cipherFormContainer.patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.login.fido2Credentials).toBeNull();
      expect(component.hasPasskey).toBe(false);
    }));

    it("should not remove the passkey when the user cancels the dialog", fakeAsync(() => {
      dialogService.open.mockReturnValue({
        closed: of(DeletePasskeyDialogResult.Cancel),
      } as DialogRef<DeletePasskeyDialogResult>);
      fixture.detectChanges();
      cipherFormContainer.patchCipher.mockClear();

      getRemovePasskeyBtn().click();

      tick();

      expect(cipherFormContainer.patchCipher).not.toHaveBeenCalled();
      expect(component.hasPasskey).toBe(true);
    }));
  });

  describe("verification code", () => {
    const query = (testId: string) =>
      fixture.nativeElement.querySelector(`[data-testid='${testId}']`);

    const editCipher = (overrides: Partial<CipherView> = {}) => {
      const login = Object.assign(new LoginView(), { totp: "JBSWY3DPEHPK3PXP" });
      const cipher = Object.assign(new CipherView(), { login, viewPassword: true }, overrides);
      getInitialCipherView.mockReturnValue(cipher);
      Object.assign(cipherFormContainer, { originalCipherView: cipher });
      organizationId$.next(cipher.organizationId ?? null);
    };

    const render = () => {
      fixture = TestBed.createComponent(LoginDetailsSectionComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    };

    beforeEach(() => {
      getInitialCipherView.mockReturnValue(null);
      Object.assign(cipherFormContainer, { originalCipherView: null });
      cipherFormContainer.config.mode = "add";
      cipherFormContainer.config.initialValues = undefined;
      upgradePathsFlag$.next(true);
    });

    describe("section", () => {
      it("moves the authenticator key into the verification code section when the flag is on", () => {
        render();

        const section = query("verification-code-section");
        expect(section).not.toBeNull();
        expect(section.querySelector("input[formControlName='totp']")).not.toBeNull();
        expect(fixture.nativeElement.querySelectorAll("input[formControlName='totp']").length).toBe(
          1,
        );
      });

      it("keeps the authenticator key in the login credentials card when the flag is off", () => {
        upgradePathsFlag$.next(false);
        render();

        expect(query("verification-code-section")).toBeNull();
        expect(fixture.nativeElement.querySelector("input[formControlName='totp']")).not.toBeNull();
      });
    });

    describe("upgrade callout", () => {
      it("shows to a free user on a personal item who has not dismissed it", () => {
        render();

        expect(nudgesService.showNudgeSpotlight$).toHaveBeenCalledWith(
          NudgeType.PremiumUpgradeTotp,
          userId,
        );
        expect(query("totp-upgrade-callout")).not.toBeNull();
      });

      it("is hidden when the flag is off", () => {
        upgradePathsFlag$.next(false);
        nudgesService.showNudgeSpotlight$.mockClear();
        billingAccountProfileStateService.hasPremiumFromAnySource$.mockClear();
        render();

        expect(query("totp-upgrade-callout")).toBeNull();
        expect(nudgesService.showNudgeSpotlight$).not.toHaveBeenCalled();
        expect(billingAccountProfileStateService.hasPremiumFromAnySource$).not.toHaveBeenCalled();
      });

      it("is hidden when editing an org-owned item", () => {
        editCipher({ organizationId: "org-id" });
        cipherFormContainer.config.mode = "edit";
        render();

        expect(query("totp-upgrade-callout")).toBeNull();
      });

      it("hides when the user chooses an organization as the owner", () => {
        render();
        expect(query("totp-upgrade-callout")).not.toBeNull();

        organizationId$.next("org-id");
        fixture.detectChanges();

        expect(query("totp-upgrade-callout")).toBeNull();
      });

      it("shows again when the owner changes back to the individual vault", () => {
        organizationId$.next("org-id");
        render();
        expect(query("totp-upgrade-callout")).toBeNull();

        organizationId$.next(null);
        fixture.detectChanges();

        expect(query("totp-upgrade-callout")).not.toBeNull();
      });
    });

    describe("TOTP code", () => {
      it("shows a Premium user an inactive code until a key is entered", fakeAsync(() => {
        hasPremium$.next(true);
        render();
        expect(query("login-totp-code").value).toBe("");
        expect(query("copy-totp-code").getAttribute("aria-disabled")).toBe("true");
        expect(query("totp-code-help")).not.toBeNull();

        component.loginDetailsForm.controls.totp.setValue("JBSWY3DPEHPK3PXP");
        fixture.detectChanges();
        tick();
        fixture.detectChanges();

        expect(query("login-totp-code").value).toBe("123 456");
      }));

      it("clears the previous code as soon as the key changes", fakeAsync(() => {
        hasPremium$.next(true);
        editCipher();
        cipherFormContainer.config.mode = "edit";
        render();
        tick();
        fixture.detectChanges();
        expect(query("login-totp-code").value).toBe("123 456");

        component.loginDetailsForm.controls.totp.setValue("NEWKEY234567ABCD");
        fixture.detectChanges();

        expect(query("login-totp-code").value).toBe("");
        tick();
      }));

      it("generates the code from the trimmed key", fakeAsync(() => {
        hasPremium$.next(true);
        render();

        component.loginDetailsForm.controls.totp.setValue("  JBSWY3DPEHPK3PXP  ");
        fixture.detectChanges();
        tick();

        expect(totpService.getCode$).toHaveBeenLastCalledWith("JBSWY3DPEHPK3PXP");
      }));

      it("stays inactive after a Premium user deletes a key typed on a new item", fakeAsync(() => {
        hasPremium$.next(true);
        dialogService.openSimpleDialog.mockResolvedValue(true);
        render();
        component.loginDetailsForm.controls.totp.setValue("JBSWY3DPEHPK3PXP");
        fixture.detectChanges();
        tick();
        fixture.detectChanges();

        query("delete-totp-button").click();
        tick();
        fixture.detectChanges();

        expect(query("login-totp-code").value).toBe("");
        expect(query("totp-code-help")).not.toBeNull();
      }));

      it("is not shown to a free user with a key", () => {
        editCipher();
        cipherFormContainer.config.mode = "edit";
        render();

        expect(query("login-totp-code")).toBeNull();
      });

      it("is not shown when the flag is off", () => {
        upgradePathsFlag$.next(false);
        hasPremium$.next(true);
        editCipher();
        cipherFormContainer.config.mode = "edit";
        render();

        expect(query("login-totp-code")).toBeNull();
      });
    });

    describe("delete authenticator key", () => {
      beforeEach(() => {
        editCipher();
        cipherFormContainer.config.mode = "edit";
        totpCaptureService.canCaptureTotp.mockReturnValue(true);
      });

      it("offers delete when a key is present", () => {
        render();

        expect(query("delete-totp-button")).not.toBeNull();
        expect(query("capture-totp-button")).toBeNull();
      });

      it("does not offer delete when the flag is off", () => {
        upgradePathsFlag$.next(false);
        render();

        expect(query("delete-totp-button")).toBeNull();
        expect(query("capture-totp-button")).not.toBeNull();
      });

      it("does not offer delete when hidden fields cannot be viewed", () => {
        editCipher({ viewPassword: false });
        render();

        expect(query("delete-totp-button")).toBeNull();
      });

      it("clears the key after the user confirms", fakeAsync(() => {
        dialogService.openSimpleDialog.mockResolvedValue(true);
        render();

        query("delete-totp-button").click();
        tick();

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            title: { key: "deleteAuthenticatorKey" },
            type: "danger",
            icon: "bwi-exclamation-triangle",
          }),
        );
        expect(component.loginDetailsForm.controls.totp.value).toBe("");
        expect(document.activeElement).toBe(
          fixture.nativeElement.querySelector("input[formControlName='totp']"),
        );
      }));

      it("keeps the key when the user cancels", fakeAsync(() => {
        dialogService.openSimpleDialog.mockResolvedValue(false);
        render();

        query("delete-totp-button").click();
        tick();

        expect(component.loginDetailsForm.controls.totp.value).toBe("JBSWY3DPEHPK3PXP");
      }));

      it("leaves a Premium user with an empty key and an inactive TOTP code", fakeAsync(() => {
        hasPremium$.next(true);
        dialogService.openSimpleDialog.mockResolvedValue(true);
        render();
        tick();
        fixture.detectChanges();
        expect(query("login-totp-code").value).toBe("123 456");
        expect(query("copy-totp-code").getAttribute("aria-disabled")).not.toBe("true");
        expect(query("totp-code-help")).toBeNull();

        query("delete-totp-button").click();
        tick();
        fixture.detectChanges();

        const code = query("login-totp-code");
        expect(code.value).toBe("");
        expect(query("copy-totp-code").getAttribute("aria-disabled")).toBe("true");
        expect(query("totp-code-help")).not.toBeNull();
        expect(query("capture-totp-button")).not.toBeNull();
        expect(query("delete-totp-button")).toBeNull();
      }));
    });
  });
});
