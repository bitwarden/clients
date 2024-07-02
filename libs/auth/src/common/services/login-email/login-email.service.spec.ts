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
  let sut: LoginEmailService;

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

    sut = new LoginEmailService(accountService, authService, stateProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("storedEmail$", () => {
    it("returns the stored email when not adding an account", async () => {
      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(true);
      await sut.saveEmailSettings();

      const result = await firstValueFrom(sut.storedEmail$);

      expect(result).toEqual("userEmail@bitwarden.com");
    });

    it("returns the stored email when not adding an account and the user has just logged in", async () => {
      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(true);
      await sut.saveEmailSettings();

      mockAuthStatuses$.next({ [userId]: AuthenticationStatus.Unlocked });
      // account service already initialized with userId as active user

      const result = await firstValueFrom(sut.storedEmail$);

      expect(result).toEqual("userEmail@bitwarden.com");
    });

    it("returns null when adding an account", async () => {
      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(true);
      await sut.saveEmailSettings();

      mockAuthStatuses$.next({
        [userId]: AuthenticationStatus.Unlocked,
        ["OtherUserId" as UserId]: AuthenticationStatus.Locked,
      });

      const result = await firstValueFrom(sut.storedEmail$);

      expect(result).toBeNull();
    });
  });

  describe("saveEmailSettings", () => {
    it("saves the email when not adding an account", async () => {
      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(true);
      await sut.saveEmailSettings();

      const result = await firstValueFrom(storedEmailState.state$);

      expect(result).toEqual("userEmail@bitwarden.com");
    });

    it("clears the email when not adding an account and rememberEmail is false", async () => {
      storedEmailState.stateSubject.next("initialEmail@bitwarden.com");

      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(false);
      await sut.saveEmailSettings();

      const result = await firstValueFrom(storedEmailState.state$);

      expect(result).toBeNull();
    });

    it("saves the email when adding an account", async () => {
      mockAuthStatuses$.next({
        [userId]: AuthenticationStatus.Unlocked,
        ["OtherUserId" as UserId]: AuthenticationStatus.Locked,
      });

      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(true);
      await sut.saveEmailSettings();

      const result = await firstValueFrom(storedEmailState.state$);

      expect(result).toEqual("userEmail@bitwarden.com");
    });

    it("does not clear the email when adding an account and rememberEmail is false", async () => {
      storedEmailState.stateSubject.next("initialEmail@bitwarden.com");

      mockAuthStatuses$.next({
        [userId]: AuthenticationStatus.Unlocked,
        ["OtherUserId" as UserId]: AuthenticationStatus.Locked,
      });

      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(false);
      await sut.saveEmailSettings();

      const result = await firstValueFrom(storedEmailState.state$);

      // result should not be null
      expect(result).toEqual("initialEmail@bitwarden.com");
    });

    it("clears the email and rememberEmail after saving", async () => {
      sut.setEmail("userEmail@bitwarden.com");
      sut.setRememberEmail(true);
      await sut.saveEmailSettings();

      const result = sut.getEmail();

      expect(result).toBeNull();
    });
  });
});
