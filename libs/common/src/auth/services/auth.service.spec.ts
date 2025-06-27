import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import {
  FakeAccountService,
  makeStaticByteArray,
  mockAccountServiceWith,
  trackEmissions,
} from "../../../spec";
import { ApiService } from "../../abstractions/api.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { TokenService } from "../abstractions/token.service";
import { AuthenticationStatus } from "../enums/authentication-status";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let sut: AuthService;

  let accountService: FakeAccountService;
  let messagingService: MockProxy<MessagingService>;
  let keyService: MockProxy<KeyService>;
  let apiService: MockProxy<ApiService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;

  const userId = Utils.newGuid() as UserId;
  const userKey = new SymmetricCryptoKey(makeStaticByteArray(32) as Uint8Array) as UserKey;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    messagingService = mock();
    keyService = mock();
    apiService = mock();
    stateService = mock();
    tokenService = mock();

    sut = new AuthService(
      accountService,
      messagingService,
      keyService,
      apiService,
      stateService,
      tokenService,
    );
  });

  describe("activeAccountStatus$", () => {
    const accountInfo = {
      status: AuthenticationStatus.Unlocked,
      id: userId,
      email: "email",
      emailVerified: false,
      name: "name",
    };

    beforeEach(() => {
      accountService.activeAccountSubject.next(accountInfo);
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));
    });

    it("emits LoggedOut when there is no active account", async () => {
      accountService.activeAccountSubject.next(undefined);

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits LoggedOut when there is no access token", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits LoggedOut when there is no access token but has a user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits Locked when there is an access token and no user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(AuthenticationStatus.Locked);
    });

    it("emits Unlocked when there is an access token and user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(AuthenticationStatus.Unlocked);
    });

    it("follows the current active user", async () => {
      const accountInfo2 = {
        status: AuthenticationStatus.Unlocked,
        id: Utils.newGuid() as UserId,
        email: "email2",
        emailVerified: false,
        name: "name2",
      };

      const emissions = trackEmissions(sut.activeAccountStatus$);

      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));
      accountService.activeAccountSubject.next(accountInfo2);

      expect(emissions).toEqual([AuthenticationStatus.Locked, AuthenticationStatus.Unlocked]);
    });
  });

  describe("authStatuses$", () => {
    it("requests auth status for all known users", async () => {
      const userId2 = Utils.newGuid() as UserId;

      await accountService.addAccount(userId2, {
        email: "email2",
        emailVerified: false,
        name: "name2",
      });

      const mockFn = jest.fn().mockReturnValue(of(AuthenticationStatus.Locked));
      sut.authStatusFor$ = mockFn;

      await expect(firstValueFrom(await sut.authStatuses$)).resolves.toEqual({
        [userId]: AuthenticationStatus.Locked,
        [userId2]: AuthenticationStatus.Locked,
      });
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith(userId);
      expect(mockFn).toHaveBeenCalledWith(userId2);
    });
  });

  describe("authStatusFor$", () => {
    beforeEach(() => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));
    });

    it.each([null, undefined, "not a userId"])(
      "emits LoggedOut when userId is invalid (%s)",
      async () => {
        expect(await firstValueFrom(sut.authStatusFor$(null))).toEqual(
          AuthenticationStatus.LoggedOut,
        );
      },
    );

    it("emits LoggedOut when there is no access token", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits Locked when there is an access token and no user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(AuthenticationStatus.Locked);
    });

    it("emits Unlocked when there is an access token and user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      keyService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.Unlocked,
      );
    });
  });
});
