import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  FakeAccountService,
  FakeGlobalState,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { LoginEmailService, STORED_EMAIL } from "./login-email.service";

describe("LoginEmailService", () => {
  let service: LoginEmailService;

  let accountService: FakeAccountService;
  let authService: MockProxy<AuthService>;
  let stateProvider: FakeStateProvider;

  const userId = "USER_ID" as UserId;
  let storedEmailState: FakeGlobalState<string>;
  let mockAuthStatuses$: BehaviorSubject<Record<UserId, AuthenticationStatus>>;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    authService = mock<AuthService>();
    stateProvider = new FakeStateProvider(accountService);

    storedEmailState = stateProvider.global.getFake(STORED_EMAIL);

    mockAuthStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({});
    authService.authStatuses$ = mockAuthStatuses$;

    service = new LoginEmailService(accountService, authService, stateProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("rememberedEmail$", () => {
    it("returns the remembered email when not adding an account", async () => {
      const testEmail = "test@bitwarden.com";

      await service.setRememberedEmailChoice(testEmail, true);

      const result = await firstValueFrom(service.rememberedEmail$);

      expect(result).toEqual(testEmail);
    });

    it("returns the remembered email when not adding an account and the user has just logged in", async () => {
      const testEmail = "test@bitwarden.com";

      await service.setRememberedEmailChoice(testEmail, true);

      mockAuthStatuses$.next({ [userId]: AuthenticationStatus.Unlocked });
      // account service already initialized with userId as active user

      const result = await firstValueFrom(service.rememberedEmail$);

      expect(result).toEqual(testEmail);
    });

    it("returns null when adding an account", async () => {
      const testEmail = "test@bitwarden.com";

      await service.setRememberedEmailChoice(testEmail, true);

      mockAuthStatuses$.next({
        [userId]: AuthenticationStatus.Unlocked,
        ["OtherUserId" as UserId]: AuthenticationStatus.Locked,
      });

      const result = await firstValueFrom(service.rememberedEmail$);

      expect(result).toBeNull();
    });
  });

  describe("setRememberedEmailChoice", () => {
    it("sets the remembered email when remember is true", async () => {
      const testEmail = "test@bitwarden.com";

      await service.setRememberedEmailChoice(testEmail, true);

      const result = await firstValueFrom(storedEmailState.state$);

      expect(result).toEqual(testEmail);
    });

    it("clears the remembered email when remember is false", async () => {
      storedEmailState.stateSubject.next("initialEmail@bitwarden.com");

      const testEmail = "test@bitwarden.com";

      await service.setRememberedEmailChoice(testEmail, false);

      const result = await firstValueFrom(storedEmailState.state$);

      expect(result).toBeNull();
    });
  });

  describe("setLoginEmail", () => {
    it("sets the login email", async () => {
      const testEmail = "test@bitwarden.com";
      await service.setLoginEmail(testEmail);

      expect(await firstValueFrom(service.loginEmail$)).toEqual(testEmail);
    });
  });

  describe("clearLoginEmail", () => {
    it("clears the login email", async () => {
      const testEmail = "test@bitwarden.com";
      await service.setLoginEmail(testEmail);
      await service.clearLoginEmail();

      expect(await firstValueFrom(service.loginEmail$)).toBeNull();
    });
  });
});
