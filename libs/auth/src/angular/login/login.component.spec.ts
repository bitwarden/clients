import { FormBuilder } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { LoginComponent } from "./login.component";

describe("LoginComponent continue() integration", () => {
  function createComponent({ flagEnabled }: { flagEnabled: boolean }) {
    const activatedRoute: any = { queryParams: { subscribe: () => {} } };
    const anonLayoutWrapperDataService: any = { setAnonLayoutWrapperData: () => {} };
    const appIdService: any = {};
    const broadcasterService: any = { subscribe: () => {}, unsubscribe: () => {} };
    const destroyRef: any = {};
    const devicesApiService: any = {};
    const formBuilder = new FormBuilder();
    const i18nService: any = { t: () => "" };
    const loginEmailService: any = {
      rememberedEmail$: { pipe: () => ({}) },
      setLoginEmail: async () => {},
      setRememberedEmailChoice: async () => {},
      clearLoginEmail: async () => {},
    };
    const loginComponentService: any = {
      showBackButton: () => {},
      isLoginWithPasskeySupported: () => false,
      redirectToSsoLogin: async () => {},
    };
    const loginStrategyService = mock<LoginStrategyServiceAbstraction>();
    const messagingService: any = { send: () => {} };
    const ngZone: any = { isStable: true, onStable: { pipe: () => ({ subscribe: () => {} }) } };
    const passwordStrengthService: any = {};
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    const policyService: any = { replace: async () => {}, evaluateMasterPassword: () => true };
    const router: any = { navigate: async () => {}, navigateByUrl: async () => {} };
    const toastService: any = { showToast: () => {} };
    const logService: any = { error: () => {} };
    const validationService: any = { showError: () => {} };
    const loginSuccessHandlerService: any = { run: async () => {} };
    const configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(flagEnabled);
    const ssoLoginService: any = { ssoRequiredCache$: { pipe: () => ({}) } };
    const environmentService: any = { environment$: { pipe: () => ({}) } };
    const webauthnLoginService = mock<WebAuthnLoginServiceAbstraction>();

    const component = new LoginComponent(
      activatedRoute,
      anonLayoutWrapperDataService,
      appIdService,
      broadcasterService,
      destroyRef,
      devicesApiService,
      formBuilder,
      i18nService,
      loginEmailService,
      loginComponentService,
      loginStrategyService,
      messagingService,
      ngZone,
      passwordStrengthService,
      platformUtilsService,
      policyService,
      router,
      toastService,
      logService,
      validationService,
      loginSuccessHandlerService,
      configService,
      ssoLoginService,
      environmentService,
      webauthnLoginService,
    );

    jest.spyOn(component as any, "toggleLoginUiState").mockResolvedValue(undefined);

    return { component, loginStrategyService };
  }

  it("calls getPasswordPrelogin on continue when flag enabled and email valid", async () => {
    const { component, loginStrategyService } = createComponent({ flagEnabled: true });
    (component as any).formGroup.controls.email.setValue("user@example.com");
    (component as any).formGroup.controls.rememberEmail.setValue(false);
    (component as any).formGroup.controls.masterPassword.setValue("irrelevant");

    await (component as any).continue();

    expect(loginStrategyService.getPasswordPrelogin).toHaveBeenCalledWith("user@example.com");
  });

  it("does not call getPasswordPrelogin when flag disabled", async () => {
    const { component, loginStrategyService } = createComponent({ flagEnabled: false });
    (component as any).formGroup.controls.email.setValue("user@example.com");
    (component as any).formGroup.controls.rememberEmail.setValue(false);
    (component as any).formGroup.controls.masterPassword.setValue("irrelevant");

    await (component as any).continue();

    expect(loginStrategyService.getPasswordPrelogin).not.toHaveBeenCalled();
  });
});
