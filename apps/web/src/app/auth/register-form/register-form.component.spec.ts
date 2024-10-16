import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterTestingModule } from "@angular/router/testing";
import { of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { FormValidationErrorsService } from "@bitwarden/angular/platform/abstractions/form-validation-errors.service";
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
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
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { SharedModule } from "../../shared";
import { AcceptOrganizationInviteService } from "../organization-invite/accept-organization.service";

import { RegisterFormComponent } from "./register-form.component";

// Mock I18nService
class MockI18nService {
  t(key: string): string {
    return key;
  }
}

// Mock PlatformUtilsService
class MockPlatformUtilsService {
  isSelfHost(): boolean {
    return false;
  }
}

// Mock ValidationService
class MockValidationService {}

// Mock PasswordStrengthServiceAbstraction
class MockPasswordStrengthServiceAbstraction {
  getPasswordStrength(password: string, email: string, name: string[]): any {
    return { score: 3 };
  }
}

describe("RegisterFormComponent", () => {
  let component: RegisterFormComponent;
  let fixture: ComponentFixture<RegisterFormComponent>;

  beforeEach(async () => {
    const authServiceMock = {
      authStatuses$: of([]),
    };
    const encryptServiceMock = {};
    const policyApiServiceMock = {};
    const organizationApiServiceMock = {};
    const organizationUserApiServiceMock = {};
    const globalStateProviderMock = {
      get: jest.fn().mockReturnValue(of({})),
    };
    const accountServiceMock = {};
    const stateProviderMock = {
      getGlobal: jest.fn().mockReturnValue({
        state$: of({}),
      }),
    };

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
        { provide: I18nService, useClass: MockI18nService },
        { provide: PlatformUtilsService, useClass: MockPlatformUtilsService },
        { provide: ValidationService, useClass: MockValidationService },
        {
          provide: PasswordStrengthServiceAbstraction,
          useClass: MockPasswordStrengthServiceAbstraction,
        },
        FormValidationErrorsService,
        LoginStrategyServiceAbstraction,
        ApiService,
        AuditService,
        PolicyService,
        CryptoService,
        EnvironmentService,
        LogService,
        StateService,
        DialogService,
        ToastService,
        PasswordGenerationServiceAbstraction,
        AcceptOrganizationInviteService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterFormComponent);
    component = fixture.componentInstance;
  });

  it("creates without error", () => {
    expect(component).toBeTruthy();
  });
});
