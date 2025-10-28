import { FormBuilder } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { ClientType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { LoginComponent } from "./login.component";

describe("LoginComponent prefetch prelogin", () => {
  function createComponent({ flagEnabled }: { flagEnabled: boolean }) {
    const activatedRoute: any = { queryParams: { subscribe: () => {} } };
    const anonLayoutWrapperDataService: any = {};
    const appIdService: any = {};
    const broadcasterService: any = { subscribe: () => {}, unsubscribe: () => {} };
    const destroyRef: any = {};
    const devicesApiService: any = {};
    const formBuilder = new FormBuilder();
    const i18nService: any = {};
    const loginEmailService: any = { rememberedEmail$: { pipe: () => ({}) } };
    const loginComponentService: any = { showBackButton: () => {} };
    const loginStrategyService = mock<LoginStrategyServiceAbstraction>();
    const messagingService: any = { send: () => {} };
    const ngZone: any = { isStable: true, onStable: { pipe: () => ({ subscribe: () => {} }) } };
    const passwordStrengthService: any = {};
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    const policyService: any = {};
    const router: any = { navigate: async () => {}, navigateByUrl: async () => {} };
    const toastService: any = { showToast: () => {} };
    const logService: any = { error: () => {} };
    const validationService: any = { showError: () => {} };
    const loginSuccessHandlerService: any = { run: async () => {} };
    const configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(flagEnabled);
    const ssoLoginService: any = { ssoRequiredCache$: { pipe: () => ({}) } };
    const environmentService: any = { environment$: { pipe: () => ({}) } };

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
    );

    // Avoid exercising toggleLoginUiState internals
    jest.spyOn(component as any, "toggleLoginUiState").mockResolvedValue(undefined);

    return { component, loginStrategyService, configService };
  }

  it("calls getPasswordPrelogin on continue when flag enabled and email valid", async () => {
    const { component, loginStrategyService } = createComponent({ flagEnabled: true });
    component.formGroup.controls.email.setValue("user@example.com");
    component.formGroup.controls.rememberEmail.setValue(false);
    component.formGroup.controls.masterPassword.setValue("irrelevant");

    await (component as any).continue();

    expect(loginStrategyService.getPasswordPrelogin).toHaveBeenCalledWith("user@example.com");
  });

  it("does not call getPasswordPrelogin when flag disabled", async () => {
    const { component, loginStrategyService } = createComponent({ flagEnabled: false });
    component.formGroup.controls.email.setValue("user@example.com");
    component.formGroup.controls.rememberEmail.setValue(false);
    component.formGroup.controls.masterPassword.setValue("irrelevant");

    await (component as any).continue();

    expect(loginStrategyService.getPasswordPrelogin).not.toHaveBeenCalled();
  });
});
