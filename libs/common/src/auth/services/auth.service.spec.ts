import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { ApiService } from "../../abstractions/api.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { AuthenticationStatus } from "../enums/authentication-status";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let sut: AuthService;

  let accountService: FakeAccountService;
  let messagingService: MockProxy<MessagingService>;
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let stateService: MockProxy<StateService>;

  const userId = Utils.newGuid() as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    messagingService = mock<MessagingService>();
    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    stateService = mock<StateService>();

    sut = new AuthService(
      accountService,
      messagingService,
      cryptoService,
      apiService,
      stateService,
    );
  });

  describe("activeAccountStatus$", () => {
    test.each([
      AuthenticationStatus.LoggedOut,
      AuthenticationStatus.Locked,
      AuthenticationStatus.Unlocked,
    ])(
      `should emit %p when activeAccount$ emits an account with %p auth status`,
      async (status) => {
        accountService.activeAccountSubject.next({
          id: userId,
          email: "email",
          name: "name",
          status,
        });

        expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(status);
      },
    );
  });
});
