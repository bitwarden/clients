import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { RegisterComponent as BaseRegisterComponent } from "@bitwarden/angular/auth/components/register.component";
import { FormValidationErrorsService } from "@bitwarden/angular/platform/abstractions/form-validation-errors.service";
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { RegisterRequest } from "@bitwarden/common/models/request/register.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { GlobalStateProvider, StateProvider } from "@bitwarden/common/platform/state";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { SharedModule } from "../../shared";
import { AcceptOrganizationInviteService } from "../organization-invite/accept-organization.service";
import { OrganizationInvite } from "../organization-invite/organization-invite";

import { RegisterFormComponent } from "./register-form.component";

describe("RegisterFormComponent", () => {
  let component: RegisterFormComponent;
  let fixture: ComponentFixture<RegisterFormComponent>;
  let policyServiceMock: jest.Mocked<PolicyService>;
  let toastServiceMock: jest.Mocked<ToastService>;
  let acceptOrgInviteServiceMock: jest.Mocked<AcceptOrganizationInviteService>;
  let logServiceMock: jest.Mocked<LogService>;

  beforeEach(async () => {
    const authServiceMock = mock<AuthService>({ authStatuses$: of({}) });
    const encryptServiceMock = mock<EncryptService>();
    const policyApiServiceMock = mock<PolicyApiServiceAbstraction>();
    const organizationApiServiceMock = mock<OrganizationApiServiceAbstraction>();
    const organizationUserApiServiceMock = mock<OrganizationUserApiService>();
    const globalStateProviderMock = mock<GlobalStateProvider>({
      get: jest.fn().mockReturnValue(of({})),
    });
    const accountServiceMock = mock<AccountService>();
    const stateProviderMock = mock<StateProvider>({
      getGlobal: jest.fn().mockReturnValue({ state$: of({}) }),
    });
    const i18nServiceMock = mock<I18nService>();
    i18nServiceMock.t.mockImplementation((key: string) => key);
    const platformUtilsServiceMock = mock<PlatformUtilsService>();
    platformUtilsServiceMock.isSelfHost.mockReturnValue(false);
    const validationServiceMock = mock<ValidationService>();
    const passwordStrengthServiceMock = mock<PasswordStrengthServiceAbstraction>();
    passwordStrengthServiceMock.getPasswordStrength.mockReturnValue({
      score: 3,
      guesses: 1000,
      guesses_log10: 3,
      crack_times_seconds: {
        online_throttling_100_per_hour: 36000,
        online_no_throttling_10_per_second: 100,
        offline_slow_hashing_1e4_per_second: 0.1,
        offline_fast_hashing_1e10_per_second: 0.0001,
      },
      crack_times_display: {
        online_throttling_100_per_hour: "10 hours",
        online_no_throttling_10_per_second: "1 minute",
        offline_slow_hashing_1e4_per_second: "0.1 seconds",
        offline_fast_hashing_1e10_per_second: "less than a second",
      },
      feedback: { warning: "", suggestions: [] },
      calc_time: 100,
      sequence: [],
    });
    const toastServiceMockTemp = mock<ToastService>();
    logServiceMock = mock<LogService>();
    const cryptoServiceMock = mock<CryptoService>({
      makeMasterKey: jest.fn().mockResolvedValue({} as any),
    });
    policyServiceMock = mock<PolicyService>();
    toastServiceMock = mock<ToastService>();
    acceptOrgInviteServiceMock = mock<AcceptOrganizationInviteService>();
    logServiceMock = mock<LogService>();

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, RouterTestingModule, SharedModule],
      declarations: [RegisterFormComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: EncryptService, useValue: encryptServiceMock },
        { provide: PolicyApiServiceAbstraction, useValue: policyApiServiceMock },
        { provide: OrganizationApiServiceAbstraction, useValue: organizationApiServiceMock },
        { provide: OrganizationUserApiService, useValue: organizationUserApiServiceMock },
        { provide: GlobalStateProvider, useValue: globalStateProviderMock },
        { provide: AccountService, useValue: accountServiceMock },
        { provide: StateProvider, useValue: stateProviderMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: PlatformUtilsService, useValue: platformUtilsServiceMock },
        { provide: ValidationService, useValue: validationServiceMock },
        { provide: PasswordStrengthServiceAbstraction, useValue: passwordStrengthServiceMock },
        { provide: ToastService, useValue: toastServiceMockTemp },
        { provide: LogService, useValue: logServiceMock },
        { provide: CryptoService, useValue: cryptoServiceMock },
        FormValidationErrorsService,
        LoginStrategyServiceAbstraction,
        ApiService,
        AuditService,
        PolicyService,
        EnvironmentService,
        StateService,
        PasswordGenerationServiceAbstraction,
        AcceptOrganizationInviteService,
        { provide: PolicyService, useValue: policyServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: AcceptOrganizationInviteService, useValue: acceptOrgInviteServiceMock },
        { provide: LogService, useValue: logServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterFormComponent);
    component = fixture.componentInstance;
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    it("sets email from queryParamEmail", async () => {
      component.queryParamEmail = "test@bitwarden.com";
      await component.ngOnInit();
      expect(component.formGroup.get("email").value).toBe("test@bitwarden.com");
    });

    it("sets characterMinimumMessage based on enforcedPolicyOptions", async () => {
      const testCases: Array<{
        enforcedPolicyOptions: MasterPasswordPolicyOptions | null;
        minimumLength?: number;
        expected: string;
      }> = [
        { enforcedPolicyOptions: null, minimumLength: 8, expected: "characterMinimum" },
        { enforcedPolicyOptions: { minLength: 10 } as MasterPasswordPolicyOptions, expected: "" },
      ];

      for (const { enforcedPolicyOptions, minimumLength, expected } of testCases) {
        component.enforcedPolicyOptions = enforcedPolicyOptions;
        component.minimumLength = minimumLength;
        await component.ngOnInit();
        expect(component.characterMinimumMessage).toBe(expected);
      }
    });
  });

  describe("submit", () => {
    it("shows error toast when password policy is not met", async () => {
      setupPasswordPolicyTest(false, 2, "weak");
      await component.submit();
      expect(toastServiceMock.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "errorOccurred",
        message: "masterPasswordPolicyRequirementsNotMet",
      });
    });

    it("calls super.submit when password policy is met", async () => {
      const submitSpy = setupPasswordPolicyTest(true, 4, "superStrongPassword123!");
      await component.submit();
      expect(submitSpy).toHaveBeenCalledWith(false);
    });
  });

  describe("modifyRegisterRequest", () => {
    it("adds organization invite details to register request when invite exists", async () => {
      const request = {
        email: "test@bitwarden.com",
        masterPasswordHash: "hashedPassword",
        masterPasswordHint: "hint",
        key: "encryptedKey",
        kdf: 0,
        kdfIterations: 100000,
        referenceData: null,
        captchaResponse: null,
        keys: {
          publicKey: "mockPublicKey",
          encryptedPrivateKey: "mockEncryptedPrivateKey",
        },
        token: null,
        organizationUserId: null,
        name: null,
      } as RegisterRequest;
      const orgInvite: OrganizationInvite = {
        organizationUserId: "123",
        token: "abc123",
        email: "test@bitwarden.com",
        initOrganization: false,
        orgSsoIdentifier: null,
        orgUserHasExistingUser: false,
        organizationId: "456",
        organizationName: "Test Org",
      };
      acceptOrgInviteServiceMock.getOrganizationInvite.mockResolvedValue(orgInvite);

      await component["modifyRegisterRequest"](request);

      expect(request.token).toBe(orgInvite.token);
      expect(request.organizationUserId).toBe(orgInvite.organizationUserId);
    });

    it("does not modify request when no organization invite exists", async () => {
      const request = {
        email: "test@bitwarden.com",
        masterPasswordHash: "hashedPassword",
        masterPasswordHint: "hint",
        key: "encryptedKey",
        kdf: 0,
        kdfIterations: 100000,
        referenceData: null,
        captchaResponse: null,
        keys: {
          publicKey: "mockPublicKey",
          encryptedPrivateKey: "mockEncryptedPrivateKey",
        },
        token: null,
        organizationUserId: null,
        name: null,
      } as RegisterRequest;
      acceptOrgInviteServiceMock.getOrganizationInvite.mockResolvedValue(null);

      await component["modifyRegisterRequest"](request);

      expect(request.token).toBeNull();
      expect(request.organizationUserId).toBeNull();
    });
  });

  /**
   * Sets up the password policy test.
   *
   * @param isPolicyMet - Whether the password policy is met.
   * @param passwordScore - The score of the password.
   * @param password - The password to set.
   * @returns The spy on the submit method.
   */
  function setupPasswordPolicyTest(isPolicyMet: boolean, passwordScore: number, password: string) {
    policyServiceMock.evaluateMasterPassword.mockReturnValue(isPolicyMet);
    component.enforcedPolicyOptions = { minLength: 10 } as MasterPasswordPolicyOptions;
    component.passwordStrengthResult = { score: passwordScore };
    component.formGroup.patchValue({ masterPassword: password });
    return jest.spyOn(BaseRegisterComponent.prototype, "submit");
  }
});
